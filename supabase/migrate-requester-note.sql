-- ===========================================================================
-- Migration: the requester's note on the public calendar, behind an admin
-- switch. Run this ONCE against a LIVE database.
--
-- Do NOT run supabase/init.sql for this: its PART 0 drops every table and
-- would delete all bookings. This file is the non-destructive equivalent -
-- it adds two columns, replaces one function, and backfills existing rows.
--
-- Safe to run twice: every statement is `if not exists` / `or replace`, and
-- the backfill only touches rows still holding NULL.
--
-- Run it in the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/migrate-requester-note.sql
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The two new columns on `events`.
--    `show_note` defaults to false, so nothing that already exists becomes
--    public as a side effect of this migration.
-- ---------------------------------------------------------------------------
alter table events add column if not exists requester_note text;
alter table events add column if not exists show_note boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. `approve_request` gained a sixth parameter, and Postgres overloads on the
--    argument list - `create or replace` alone would leave the old
--    five-argument function in place beside the new one, making every call
--    that omits the flag ambiguous (42725). Drop the old signature first.
-- ---------------------------------------------------------------------------
drop function if exists approve_request(uuid, int, timestamptz, timestamptz, text) cascade;

create or replace function approve_request(
  p_request_id uuid,
  p_version    int,
  p_start      timestamptz default null,   -- null => use requested times
  p_end        timestamptz default null,
  p_note       text default null,
  -- FR-4: whether the requester's own note is published with the event. The
  -- admin ticks this on the pending-queue card before approving; unticked (the
  -- default) the note is still stored, just not shown to visitors.
  p_show_note  boolean default false
) returns events
language plpgsql security definer set search_path = public as $$
declare
  r booking_requests;
  v_start timestamptz;
  v_end   timestamptz;
  v_event events;
  v_modified boolean;
begin
  if not is_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into r from booking_requests where id = p_request_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'ERR_ALREADY_DECIDED'; end if;
  if r.version <> p_version then raise exception 'ERR_STALE'; end if;

  v_start := coalesce(p_start, r.requested_start);
  v_end   := coalesce(p_end,   r.requested_end);
  v_modified := (v_start, v_end) is distinct from (r.requested_start, r.requested_end);

  if v_end <= v_start then raise exception 'ERR_VALIDATION'; end if;

  if exists (
    select 1 from closures c
    where tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    raise exception 'ERR_CLOSED';
  end if;

  -- `requester_note` always carries the requester's own words across, so the
  -- event editor can publish them later without going back to the request;
  -- `show_note` is what decides whether a visitor ever sees them.
  -- `description` is left empty so it stays the admin's field to write in.
  insert into events (title, usage_type, starts_at, ends_at, source, request_id,
                      requester_note, show_note,
                      contact_name, contact_phone, created_by)
  values (r.requester_name, r.usage_type, v_start, v_end, 'request', r.id,
          nullif(btrim(coalesce(r.note, '')), ''), coalesce(p_show_note, false),
          r.requester_name, r.requester_phone, auth.uid())
  returning * into v_event;   -- exclusion constraint raises 23P01 => ERR_SLOT_CONFLICT

  -- `::request_status` for the same reason as in decide_access_request() above:
  -- an all-literal `case` is `text`, and assigning text to an enum column is
  -- error 42804.
  update booking_requests
     set status = (case when v_modified then 'approved_modified' else 'approved' end)::request_status,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note,
         final_start = v_start, final_end = v_end, version = version + 1
   where id = r.id;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'booking_request', r.id, 'approve',
          to_jsonb(r), jsonb_build_object('event_id', v_event.id,
                                          'start', v_start, 'end', v_end,
                                          'modified', v_modified));

  return v_event;
exception
  when exclusion_violation then
    raise exception 'ERR_SLOT_CONFLICT';
end;
$$;

-- A freshly created function grants EXECUTE to PUBLIC by default. Lock the new
-- signature down the way init.sql does: managers only, never anon.
revoke all on function approve_request(uuid, int, timestamptz, timestamptz, text, boolean) from public, anon;
grant execute on function approve_request(uuid, int, timestamptz, timestamptz, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Backfill: copy the note onto events approved before this change, so the
--    admin can publish an old one from the event editor without going back to
--    the request. `show_note` stays false for all of them - the copy is
--    invisible to visitors until a manager ticks the box.
-- ---------------------------------------------------------------------------
update events e
   set requester_note = nullif(btrim(coalesce(b.note, '')), '')
  from booking_requests b
 where e.request_id = b.id
   and e.requester_note is null;

commit;
