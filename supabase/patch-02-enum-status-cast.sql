-- ===========================================================================
-- PATCH 02 — text -> enum assignment in the two `case` status updates
--
-- Apply to the LIVE database (Supabase dashboard → SQL editor). Idempotent:
-- both statements are `create or replace`, so re-running it is a no-op. These
-- same changes are already folded into init.sql, so a fresh deployment needs
-- nothing extra.
--
-- WHAT WAS WRONG
-- --------------
-- Two functions set an enum-typed `status` column from a `case` expression:
--
--   decide_access_request()  access_requests.status   access_request_status
--   approve_request()        booking_requests.status  request_status
--
-- A `case` whose branches are all bare string literals does NOT stay `unknown`
-- the way a single literal does — Postgres resolves it to `text`. There is no
-- implicit assignment cast from text to an enum, so both updates failed at
-- runtime with
--
--   42804  column "status" is of type access_request_status
--          but expression is of type text
--
-- This is a runtime error, not a creation-time one: `create function` does not
-- plan the body, so both functions installed cleanly and only failed when
-- actually called. In the application that surfaced as a bare HTTP 500 —
-- `codeFromDbError` finds no `ERR_` code in a Postgres message like this and
-- falls through to ERR_INTERNAL.
--
-- Impact before this patch:
--   decide_access_request   NO access request could be approved or rejected.
--                           The super admin queue at /admin/access was a dead
--                           end: every decision returned 500 and nothing was
--                           written, so no self-service admin could ever be
--                           let in.
--   approve_request         NO booking request could be approved. Note the
--                           ordering inside that function — the `events` row is
--                           inserted BEFORE this update, so the whole
--                           transaction rolled back on the failure and no
--                           orphan event was left behind. Rejections were
--                           unaffected (`reject_request` assigns a single bare
--                           literal, which coerces correctly).
--
-- Only these two sites are affected. Every other status write in the schema
-- assigns one bare literal (`set status = 'cancelled'`, `set status =
-- 'expired'`, …), which stays `unknown` and is coerced to the column's own
-- type. The other two `case` expressions in the schema target `audit_log.action`
-- and `admin_allowlist.revoked_at`, neither of which is an enum.
-- ===========================================================================

create or replace function decide_access_request(
  p_request_id uuid,
  p_approve    boolean,
  p_role       admin_role default 'admin',
  p_note       text default null
) returns access_requests
language plpgsql security definer set search_path = public as $$
declare
  target   access_requests;
  existing admin_allowlist;
begin
  if not is_super_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into target from access_requests where id = p_request_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;

  -- A request is decided once. Re-approving a decided row would let an
  -- allowlist entry be recreated from a stale browser tab.
  if target.status <> 'pending' then
    raise exception 'ERR_ALREADY_DECIDED';
  end if;

  -- THE FIX: `::access_request_status`.
  update access_requests
     set status       = (case when p_approve then 'approved' else 'rejected' end)::access_request_status,
         decided_at   = now(),
         decided_by   = auth.uid(),
         decided_note = p_note
   where id = target.id
  returning * into target;

  if p_approve then
    -- Same restore-rather-than-collide behaviour as add_manager(): the unique
    -- index on admin_allowlist covers active rows only, but the audit trail
    -- must stay on one row per address.
    select * into existing from admin_allowlist where email = target.email;

    if found then
      update admin_allowlist
         set revoked_at = null,
             role       = p_role,
             full_name  = coalesce(existing.full_name, target.full_name)
       where id = existing.id
      returning * into existing;
    else
      insert into admin_allowlist (email, full_name, role, created_by)
      values (target.email, target.full_name, p_role, auth.uid())
      returning * into existing;
    end if;

    insert into audit_log (actor_id, entity, entity_id, action, before, after)
    values (auth.uid(), 'admin_allowlist', existing.id, 'add', null, to_jsonb(existing));
  end if;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'access_requests', target.id,
          case when p_approve then 'approve' else 'reject' end,
          null, to_jsonb(target));

  return target;
end;
$$;


create or replace function approve_request(
  p_request_id uuid,
  p_version    int,
  p_start      timestamptz default null,   -- null => use requested times
  p_end        timestamptz default null,
  p_note       text default null
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

  insert into events (title, usage_type, starts_at, ends_at, source, request_id,
                      contact_name, contact_phone, created_by)
  values (r.requester_name, r.usage_type, v_start, v_end, 'request', r.id,
          r.requester_name, r.requester_phone, auth.uid())
  returning * into v_event;   -- exclusion constraint raises 23P01 => ERR_SLOT_CONFLICT

  -- THE FIX: `::request_status`.
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
