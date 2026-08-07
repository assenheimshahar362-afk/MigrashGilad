-- ===========================================================================
-- Migrash Gilad — the whole database, in one migration.
--
-- This is the single source of truth for the schema. It is applied by the
-- Supabase CLI (`supabase db reset`, `supabase db push`) and by CI, and it can
-- equally be pasted whole into the Supabase dashboard SQL editor — it contains
-- no psql meta-commands, so both paths work.
--
--   PART 1 schema     — extensions, enums, tables, indexes, guard triggers
--   PART 2 functions  — security-definer RPCs and grants
--   PART 3 rls        — row level security on every table
--   PART 4 bootstrap  — the first super admin and the single settings row
--
-- Sample data lives in supabase/seed.sql and is applied separately, by
-- `supabase db reset` without --no-seed. It is development data and does not
-- belong in a real database.
--
-- Re-runnable. Every statement is `if not exists` / `or replace` /
-- `drop ... if exists`, so running it twice is a no-op rather than an error.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN: set the super admin at the bottom of this file, under
-- "PART 4 — BOOTSTRAP". §2 says the super admin tier is bootstrapped, not
-- granted; no UI can create the first one. If you leave the placeholder you
-- will not be able to sign in as an administrator.
-- ---------------------------------------------------------------------------
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
-- PART 1 — SCHEMA
-- Spec §6.1 extensions and enums, §6.2 tables.
--
-- Guiding constraint (§1.4): the system manages exactly one pitch. There is no
-- facility entity and no pitch_id column anywhere below. Do not add one.
-- ===========================================================================
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type usage_type as enum (
    'community',      -- שימוש קהילתי
    'association',    -- שימוש עמותה
    'special_event',  -- אירוע מיוחד
    'maintenance',    -- תחזוקה
    'closed'          -- סגור
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum (
    'pending', 'approved', 'approved_modified', 'rejected', 'cancelled', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum ('scheduled', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_source as enum ('manual', 'request', 'recurring');
exception when duplicate_object then null; end $$;

-- Only two authenticated tiers exist. A visitor has no row anywhere.
do $$ begin
  create type admin_role as enum ('admin', 'super_admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists admin_allowlist (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null unique,
  full_name    text,
  role         admin_role not null default 'admin',
  notify_email boolean not null default true,
  notify_push  boolean not null default true,
  phone_e164   text,                    -- for WhatsApp fan-out of new requests
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  revoked_at   timestamptz
);

create unique index if not exists admin_allowlist_active_email_idx
  on admin_allowlist (email) where revoked_at is null;

-- Guarantee: at least one active super admin exists at all times. Deferred so
-- that a promote-then-demote pair inside one transaction is legal, and only the
-- end state is judged.
create or replace function assert_super_admin_survives()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from admin_allowlist
    where role = 'super_admin' and revoked_at is null
  ) then
    raise exception 'ERR_LAST_SUPER_ADMIN';
  end if;
  return null;
end;
$$;

drop trigger if exists admin_allowlist_super_guard on admin_allowlist;
create constraint trigger admin_allowlist_super_guard
  after update or delete on admin_allowlist
  deferrable initially deferred
  for each row execute function assert_super_admin_survives();

create table if not exists admin_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      citext not null,
  full_name  text,
  avatar_url text,
  last_seen  timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trustees (נאמני קהילה)
-- ---------------------------------------------------------------------------
create table if not exists trustees (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  title          text,                  -- e.g. "נאמן מגרש", "רכז נוער"
  phone_e164     text not null,
  whatsapp_ok    boolean not null default true,
  photo_url      text,
  display_order  int  not null default 0,
  is_primary     boolean not null default false,
  is_available   boolean not null default true,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists trustees_visible_idx on trustees (is_archived, display_order);

-- ---------------------------------------------------------------------------
-- Booking requests
-- ---------------------------------------------------------------------------
create table if not exists booking_requests (
  id                uuid primary key default gen_random_uuid(),
  -- 24 random bytes, base64url (§7 token entropy). `encode(...,'base64url')`
  -- only exists from PG18, so the alphabet is translated by hand; 24 bytes is
  -- divisible by 3, so there is never any '=' padding to strip.
  public_token      text not null unique
                      default translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_'),
  requester_name    text not null check (char_length(trim(requester_name)) between 2 and 80),
  requester_phone   text not null check (requester_phone ~ '^\+9725[0-9]{8}$'),
  usage_type        usage_type not null default 'community',
  requested_start   timestamptz not null,
  requested_end     timestamptz not null,
  participants      int check (participants between 1 and 200),
  note              text check (char_length(note) <= 500),
  status            request_status not null default 'pending',
  decided_by        uuid references auth.users(id),
  decided_at        timestamptz,
  decision_note     text check (char_length(decision_note) <= 500),
  final_start       timestamptz,        -- set when approved_modified
  final_end         timestamptz,
  version           int not null default 1,
  submitted_ip_hash text,
  anonymised_at     timestamptz,
  created_at        timestamptz not null default now(),
  constraint req_time_order check (requested_end > requested_start),
  constraint req_duration   check (requested_end - requested_start <= interval '6 hours')
);
create index if not exists requests_status_idx on booking_requests (status, requested_start);
create index if not exists requests_phone_idx  on booking_requests (requester_phone, created_at desc);

-- ---------------------------------------------------------------------------
-- Recurring allocation rules (declared before `events`, which references it)
-- ---------------------------------------------------------------------------
create table if not exists recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  usage_type   usage_type not null,
  weekday      int not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time   time not null,
  end_time     time not null,
  valid_from   date not null,
  valid_until  date,
  is_active    boolean not null default true,
  contact_name text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  constraint rule_time_order check (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- Events (the actual schedule)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  usage_type      usage_type not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          event_status not null default 'scheduled',
  source          event_source not null default 'manual',
  request_id      uuid unique references booking_requests(id) on delete set null,
  recurring_id    uuid references recurring_rules(id) on delete cascade,
  occurrence_date date,                 -- for recurring occurrences, the local date
  contact_name    text,
  contact_phone   text,
  show_contact    boolean not null default false,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint event_time_order check (ends_at > starts_at)
);

-- Hard guarantee (G4): no two live events overlap. Enforced in the database,
-- not only in the UI.
do $$ begin
  alter table events add constraint events_no_overlap
    exclude using gist (
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status = 'scheduled');
exception when duplicate_object then null; end $$;

create index if not exists events_range_idx on events using gist (tstzrange(starts_at, ends_at, '[)'));
create index if not exists events_starts_idx on events (starts_at) where status = 'scheduled';
create unique index if not exists events_recurring_occurrence_idx
  on events (recurring_id, occurrence_date) where recurring_id is not null;

-- ---------------------------------------------------------------------------
-- Closures
-- ---------------------------------------------------------------------------
create table if not exists closures (
  id         uuid primary key default gen_random_uuid(),
  reason     text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  all_day    boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint closure_time_order check (ends_at > starts_at)
);
create index if not exists closures_range_idx on closures using gist (tstzrange(starts_at, ends_at, '[)'));

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists site_settings (
  id                  int primary key default 1 check (id = 1),
  pitch_name          text not null default 'מגרש גלעד',
  -- Keys "0".."6" = Sunday..Saturday. ALL SEVEN keys are required and are
  -- treated identically; a day is closed only by an explicit null value.
  -- Seed: every day ["06:00","23:00"].
  opening_hours       jsonb not null,
  min_lead_hours      int  not null default 12,
  max_horizon_days    int  not null default 90,
  max_duration_min    int  not null default 180,
  requests_open       boolean not null default true,
  requests_closed_msg text,
  memorial_html       text,
  memorial_days       date[] not null default '{}',
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id)
);

-- All seven keys must be present. Friday and Saturday are ordinary operating
-- days (§1.4) — the schema refuses to let them be quietly omitted.
create or replace function assert_opening_hours_shape()
returns trigger language plpgsql as $$
declare
  d int;
begin
  for d in 0..6 loop
    if not (new.opening_hours ? d::text) then
      raise exception 'ERR_OPENING_HOURS_INCOMPLETE: missing day %', d;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists site_settings_opening_hours_guard on site_settings;
create trigger site_settings_opening_hours_guard
  before insert or update on site_settings
  for each row execute function assert_opening_hours_shape();

-- ---------------------------------------------------------------------------
-- Audit + notifications
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id),
  actor_label text,
  entity      text not null,        -- 'booking_request' | 'event' | ...
  entity_id   uuid,
  action      text not null,        -- 'create' | 'approve' | 'reject' | ...
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on audit_log (entity, created_at desc);

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists notification_log (
  id         bigserial primary key,
  channel    text not null,         -- 'email' | 'push' | 'whatsapp'
  target     text not null,
  subject    text,
  payload    jsonb,
  status     text not null,         -- 'sent' | 'failed'
  error      text,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key          text primary key,    -- 'phone:+9725...' | 'ip:<hash>'
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at housekeeping
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_touch on events;
create trigger events_touch before update on events
  for each row execute function touch_updated_at();

drop trigger if exists trustees_touch on trustees;
create trigger trustees_touch before update on trustees
  for each row execute function touch_updated_at();


-- ===========================================================================
-- ===========================================================================
-- PART 2 — FUNCTIONS
-- Spec §6.3. Every guarded mutation is a `security definer` RPC so that the
-- invariants of §2 cannot be bypassed by writing to a table directly.
-- ===========================================================================
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_allowlist a
    join auth.users u on lower(u.email) = lower(a.email::text)
    where u.id = auth.uid() and a.revoked_at is null
  );
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_allowlist a
    join auth.users u on lower(u.email) = lower(a.email::text)
    where u.id = auth.uid()
      and a.revoked_at is null
      and a.role = 'super_admin'
  );
$$;

-- The row belonging to the caller, used to block self-demotion.
create or replace function my_allowlist_id() returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from admin_allowlist a
  join auth.users u on lower(u.email) = lower(a.email::text)
  where u.id = auth.uid() and a.revoked_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Manager administration (§2, FR-36, FR-36a)
-- ---------------------------------------------------------------------------
create or replace function set_manager_role(
  p_allowlist_id uuid,
  p_role         admin_role,   -- null-safe; pass current role to only revoke
  p_revoke       boolean default false
) returns admin_allowlist
language plpgsql security definer set search_path = public as $$
declare
  target admin_allowlist;
  before_snapshot jsonb;
begin
  if not is_super_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into target from admin_allowlist where id = p_allowlist_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;

  before_snapshot := to_jsonb(target);

  -- You may not demote or revoke yourself.
  if target.id = my_allowlist_id()
     and (p_revoke or (p_role is not null and p_role <> 'super_admin')) then
    raise exception 'ERR_CANNOT_DEMOTE_SELF';
  end if;

  update admin_allowlist
     set role = coalesce(p_role, role),
         revoked_at = case when p_revoke then now() else null end
   where id = target.id
  returning * into target;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'admin_allowlist', target.id,
          case when p_revoke then 'revoke' else 'set_role' end,
          before_snapshot, to_jsonb(target));

  return target;  -- the deferred constraint trigger raises ERR_LAST_SUPER_ADMIN if needed
end;
$$;

create or replace function add_manager(
  p_email     citext,
  p_full_name text default null,
  p_role      admin_role default 'admin'
) returns admin_allowlist
language plpgsql security definer set search_path = public as $$
declare
  target admin_allowlist;
begin
  if not is_super_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  -- Re-adding a revoked email restores it rather than colliding: the unique
  -- index is on active rows only, but the audit trail must stay on one row.
  select * into target from admin_allowlist where email = p_email;

  if found then
    if target.revoked_at is null then
      raise exception 'ERR_DUPLICATE';
    end if;
    update admin_allowlist
       set revoked_at = null,
           role = p_role,
           full_name = coalesce(p_full_name, full_name)
     where id = target.id
    returning * into target;
  else
    insert into admin_allowlist (email, full_name, role, created_by)
    values (p_email, p_full_name, p_role, auth.uid())
    returning * into target;
  end if;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'admin_allowlist', target.id, 'add', null, to_jsonb(target));

  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approval workflow (§4.3, §5)
-- ---------------------------------------------------------------------------
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

  update booking_requests
     set status = case when v_modified then 'approved_modified' else 'approved' end,
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

create or replace function reject_request(
  p_request_id uuid,
  p_version    int,
  p_note       text default null
) returns booking_requests
language plpgsql security definer set search_path = public as $$
declare
  r booking_requests;
  updated booking_requests;
begin
  if not is_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into r from booking_requests where id = p_request_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'ERR_ALREADY_DECIDED'; end if;
  if r.version <> p_version then raise exception 'ERR_STALE'; end if;

  update booking_requests
     set status = 'rejected',
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note,
         version = version + 1
   where id = r.id
  returning * into updated;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'booking_request', r.id, 'reject', to_jsonb(r), to_jsonb(updated));

  return updated;
end;
$$;

-- Cancelling an approved request soft-deletes its event (§5), it does not
-- delete the row.
create or replace function cancel_request_admin(
  p_request_id uuid,
  p_version    int,
  p_note       text default null
) returns booking_requests
language plpgsql security definer set search_path = public as $$
declare
  r booking_requests;
  updated booking_requests;
begin
  if not is_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into r from booking_requests where id = p_request_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if r.status not in ('pending', 'approved', 'approved_modified') then
    raise exception 'ERR_NOT_CANCELLABLE';
  end if;
  if r.version <> p_version then raise exception 'ERR_STALE'; end if;

  update events set status = 'cancelled' where request_id = r.id;

  update booking_requests
     set status = 'cancelled', decided_by = auth.uid(), decided_at = now(),
         decision_note = coalesce(p_note, decision_note), version = version + 1
   where id = r.id
  returning * into updated;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'booking_request', r.id, 'cancel_admin', to_jsonb(r), to_jsonb(updated));

  return updated;
end;
$$;

-- No auth: reached only through the server route handler, which has already
-- resolved an unguessable token to this id. Valid only while `pending` (§5).
create or replace function cancel_request_public(p_token text)
returns booking_requests
language plpgsql security definer set search_path = public as $$
declare
  r booking_requests;
  updated booking_requests;
begin
  select * into r from booking_requests where public_token = p_token for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'ERR_NOT_CANCELLABLE'; end if;

  update booking_requests
     set status = 'cancelled', version = version + 1
   where id = r.id
  returning * into updated;

  insert into audit_log (actor_id, actor_label, entity, entity_id, action, before, after)
  values (null, 'requester', 'booking_request', r.id, 'cancel_public',
          to_jsonb(r), to_jsonb(updated));

  return updated;
end;
$$;

-- FR-26: pending requests older than the requested date auto-expire.
create or replace function expire_stale_requests()
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with expired as (
    update booking_requests
       set status = 'expired', version = version + 1
     where status = 'pending' and requested_start < now()
    returning id
  )
  select count(*) into n from expired;

  if n > 0 then
    insert into audit_log (actor_label, entity, action, after)
    values ('cron', 'booking_request', 'expire', jsonb_build_object('count', n));
  end if;

  return n;
end;
$$;

-- §7 retention: terminal-state requests older than 24 months are anonymised.
create or replace function anonymise_old_requests(p_months int default 24)
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with scrubbed as (
    update booking_requests
       set requester_name = 'משתמש שהוסר',
           requester_phone = '+972500000000',
           note = null,
           submitted_ip_hash = null,
           anonymised_at = now()
     where status in ('rejected', 'cancelled', 'expired', 'approved', 'approved_modified')
       and created_at < now() - make_interval(months => p_months)
       and anonymised_at is null
    returning id
  )
  select count(*) into n from scrubbed;

  if n > 0 then
    insert into audit_log (actor_id, actor_label, entity, action, after)
    values (auth.uid(), 'maintenance', 'booking_request', 'anonymise',
            jsonb_build_object('count', n));
  end if;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recurring materialisation (FR-8, FR-34)
--
-- Idempotent: `events_recurring_occurrence_idx` makes a re-run a no-op for
-- occurrences that already exist, including ones an admin has individually
-- cancelled — those keep status 'cancelled' and are not resurrected.
--
-- All seven weekdays are treated identically (§14). Friday (5) and Saturday (6)
-- are not skipped, and the loop below has no weekday special case.
-- ---------------------------------------------------------------------------
create or replace function materialize_recurring(p_horizon_days int default 120)
returns int
language plpgsql security definer set search_path = public as $$
declare
  rule    recurring_rules;
  d       date;
  horizon date := (now() at time zone 'Asia/Jerusalem')::date + p_horizon_days;
  today   date := (now() at time zone 'Asia/Jerusalem')::date;
  v_start timestamptz;
  v_end   timestamptz;
  created int := 0;
begin
  for rule in
    select * from recurring_rules where is_active
  loop
    d := greatest(rule.valid_from, today);
    -- Postgres extract(dow) is 0 = Sunday, matching recurring_rules.weekday.
    d := d + ((rule.weekday - extract(dow from d)::int + 7) % 7);

    while d <= least(horizon, coalesce(rule.valid_until, horizon)) loop
      v_start := (d + rule.start_time) at time zone 'Asia/Jerusalem';
      v_end   := (d + rule.end_time)   at time zone 'Asia/Jerusalem';

      begin
        insert into events (title, usage_type, starts_at, ends_at, source,
                            recurring_id, occurrence_date, contact_name, created_by)
        values (rule.title, rule.usage_type, v_start, v_end, 'recurring',
                rule.id, d, rule.contact_name, rule.created_by);
        created := created + 1;
      exception
        -- Occurrence already materialised.
        when unique_violation then null;
        -- A one-off event already owns this slot; the manual entry wins and
        -- the series simply has a hole on that date.
        when exclusion_violation then null;
      end;

      d := d + 7;
    end loop;
  end loop;

  if created > 0 then
    insert into audit_log (actor_id, actor_label, entity, action, after)
    values (auth.uid(), 'cron', 'event', 'materialize',
            jsonb_build_object('created', created, 'horizon_days', p_horizon_days));
  end if;

  return created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Closures (FR-35): creating a closure may cancel the events it covers.
-- ---------------------------------------------------------------------------
create or replace function create_closure(
  p_reason           text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_all_day          boolean default false,
  p_cancel_conflicts boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c closures;
  cancelled int := 0;
begin
  if not is_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  insert into closures (reason, starts_at, ends_at, all_day, created_by)
  values (p_reason, p_starts_at, p_ends_at, p_all_day, auth.uid())
  returning * into c;

  if p_cancel_conflicts then
    with hit as (
      update events
         set status = 'cancelled'
       where status = 'scheduled'
         and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      returning id
    )
    select count(*) into cancelled from hit;
  end if;

  insert into audit_log (actor_id, entity, entity_id, action, after)
  values (auth.uid(), 'closure', c.id, 'create',
          jsonb_build_object('closure', to_jsonb(c), 'cancelled_events', cancelled));

  return jsonb_build_object('closure', to_jsonb(c), 'cancelled', cancelled);
end;
$$;

-- Which events would a proposed closure cancel? Used to populate the
-- confirmation dialog before anything is written.
create or replace function preview_closure_conflicts(
  p_starts_at timestamptz,
  p_ends_at   timestamptz
) returns setof events
language sql stable security definer set search_path = public as $$
  select * from events
   where status = 'scheduled'
     and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
   order by starts_at;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The anon role may only call the availability helper; everything else
-- is either admin-gated inside the function or proxied by the server.
-- ---------------------------------------------------------------------------
revoke all on function set_manager_role(uuid, admin_role, boolean) from public, anon;
revoke all on function add_manager(citext, text, admin_role) from public, anon;
revoke all on function cancel_request_public(text) from public, anon;
revoke all on function expire_stale_requests() from public, anon;
revoke all on function anonymise_old_requests(int) from public, anon;
revoke all on function materialize_recurring(int) from public, anon;
revoke all on function create_closure(text, timestamptz, timestamptz, boolean, boolean) from public, anon;
revoke all on function preview_closure_conflicts(timestamptz, timestamptz) from public, anon;
revoke all on function approve_request(uuid, int, timestamptz, timestamptz, text) from public, anon;
revoke all on function reject_request(uuid, int, text) from public, anon;
revoke all on function cancel_request_admin(uuid, int, text) from public, anon;

grant execute on function approve_request(uuid, int, timestamptz, timestamptz, text) to authenticated;
grant execute on function reject_request(uuid, int, text) to authenticated;
grant execute on function cancel_request_admin(uuid, int, text) to authenticated;
grant execute on function set_manager_role(uuid, admin_role, boolean) to authenticated;
grant execute on function add_manager(citext, text, admin_role) to authenticated;
grant execute on function create_closure(text, timestamptz, timestamptz, boolean, boolean) to authenticated;
grant execute on function preview_closure_conflicts(timestamptz, timestamptz) to authenticated;
grant execute on function materialize_recurring(int) to authenticated;
grant execute on function anonymise_old_requests(int) to authenticated;
grant execute on function expire_stale_requests() to authenticated;
grant execute on function is_admin() to authenticated, anon;
grant execute on function is_super_admin() to authenticated, anon;


-- ===========================================================================
-- ===========================================================================
-- PART 3 — ROW LEVEL SECURITY
-- Spec §6.4. RLS is enabled on EVERY table. The public site reads with the
-- anon key; all public writes go through server-side route handlers using the
-- service role key, never directly from the browser.
-- ===========================================================================
-- ===========================================================================

alter table events             enable row level security;
alter table trustees           enable row level security;
alter table closures           enable row level security;
alter table site_settings      enable row level security;
alter table booking_requests   enable row level security;
alter table recurring_rules    enable row level security;
alter table admin_allowlist    enable row level security;
alter table admin_profiles     enable row level security;
alter table audit_log          enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_log   enable row level security;
alter table rate_limits        enable row level security;

-- ---------------------------------------------------------------------------
-- Public read of the schedule
-- ---------------------------------------------------------------------------
drop policy if exists events_public_read on events;
create policy events_public_read on events
  for select to anon, authenticated
  using (status = 'scheduled');

drop policy if exists trustees_public_read on trustees;
create policy trustees_public_read on trustees
  for select to anon, authenticated
  using (is_archived = false);

drop policy if exists closures_public_read on closures;
create policy closures_public_read on closures
  for select to anon, authenticated using (true);

drop policy if exists settings_public_read on site_settings;
create policy settings_public_read on site_settings
  for select to anon, authenticated using (true);

drop policy if exists recurring_public_read on recurring_rules;
create policy recurring_public_read on recurring_rules
  for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Booking requests: NO anon access at all. Public reads/writes are proxied by
-- the server, which filters by public_token.
-- ---------------------------------------------------------------------------
drop policy if exists requests_admin_all on booking_requests;
create policy requests_admin_all on booking_requests
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Admin write access
-- ---------------------------------------------------------------------------
drop policy if exists events_admin_write on events;
create policy events_admin_write on events
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists trustees_admin_write on trustees;
create policy trustees_admin_write on trustees
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists closures_admin_write on closures;
create policy closures_admin_write on closures
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists recurring_admin_write on recurring_rules;
create policy recurring_admin_write on recurring_rules
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists settings_super_write on site_settings;
create policy settings_super_write on site_settings
  for update to authenticated using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- Admins may see who the managers are; only the super admin may change the
-- list, and even then only through set_manager_role().
-- ---------------------------------------------------------------------------
drop policy if exists allowlist_admin_read on admin_allowlist;
create policy allowlist_admin_read on admin_allowlist
  for select to authenticated using (is_admin());

drop policy if exists allowlist_super_insert on admin_allowlist;
create policy allowlist_super_insert on admin_allowlist
  for insert to authenticated with check (is_super_admin());
-- Deliberately NO update/delete policy: writes go through the RPC.

drop policy if exists audit_super_read on audit_log;
create policy audit_super_read on audit_log
  for select to authenticated using (is_super_admin());

drop policy if exists push_self on push_subscriptions;
create policy push_self on push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- An admin sees and maintains only their own profile row; the manager screen
-- reads `last_seen` for everyone, so admins may read all profiles.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_admin_read on admin_profiles;
create policy profiles_admin_read on admin_profiles
  for select to authenticated using (is_admin());

drop policy if exists profiles_self_write on admin_profiles;
create policy profiles_self_write on admin_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_log and rate_limits are written only by the service role, which
-- bypasses RLS. No policy at all means no access for anon or authenticated,
-- which is the intent — but the super admin needs to read failures for the ops
-- view (§19).
-- ---------------------------------------------------------------------------
drop policy if exists notifications_super_read on notification_log;
create policy notifications_super_read on notification_log
  for select to authenticated using (is_super_admin());


-- ===========================================================================
-- ===========================================================================
-- PART 4 — BOOTSTRAP
--
-- §2: the super admin tier is bootstrapped, not granted. The first row is
-- inserted here; no UI can create the first one.
--
-- The address is a literal rather than a psql `\set` variable so that this file
-- runs unchanged in the dashboard SQL editor, which is not psql and cannot
-- execute meta-commands.
-- ===========================================================================
-- ===========================================================================

-- >>> EDIT THESE TWO LINES BEFORE RUNNING <<<
-- The email must match the address you will sign in with. Re-running with a
-- different email adds a second super admin; it does not replace the first.
do $$
declare
  v_super_admin_email citext := 'dev-super-admin@example.com';
  v_super_admin_name  text   := 'מנהל על';
begin
  insert into admin_allowlist (email, full_name, role)
  values (v_super_admin_email, v_super_admin_name, 'super_admin')
  on conflict (email) do update
    set role = 'super_admin',
        revoked_at = null;

  if v_super_admin_email = 'dev-super-admin@example.com' then
    raise notice 'Super admin left at the placeholder address — edit it and re-run, or no one can sign in.';
  end if;
end $$;

-- The single settings row. All seven keys are required and identical: Friday
-- and Saturday are ordinary operating days (§1.4, FR-37a).
insert into site_settings (id, opening_hours)
values (
  1,
  jsonb_build_object(
    '0', jsonb_build_array('06:00', '23:00'),
    '1', jsonb_build_array('06:00', '23:00'),
    '2', jsonb_build_array('06:00', '23:00'),
    '3', jsonb_build_array('06:00', '23:00'),
    '4', jsonb_build_array('06:00', '23:00'),
    '5', jsonb_build_array('06:00', '23:00'),
    '6', jsonb_build_array('06:00', '23:00')
  )
)
on conflict (id) do nothing;
