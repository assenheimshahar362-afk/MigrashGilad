-- ===========================================================================
-- Migrash Gilad — the whole database, in one file.
--
-- Single source of truth for the schema. Paste whole into the Supabase
-- dashboard SQL editor. Contains no psql meta-commands.
--
--   PART 1 schema     — extensions, enums, tables, indexes, guard triggers
--   PART 2 functions  — security-definer RPCs and grants
--   PART 3 rls        — row level security on every table
--   PART 4 bootstrap  — the first super admin
--
-- usage_type carries only 'community' and 'association' — the product
-- recognises exactly these two categories, baked in directly.
-- Sample data lives in supabase/seed.sql, run after this file.
--
-- This file is the ONLY schema file. Two patches once lived beside it and
-- have been folded in and deleted, since every statement they carried is
-- present here verbatim:
--
--   security-patch-01-definer-rpcs   authorization on the `security definer`
--                                    maintenance RPCs — is_service_role(),
--                                    expire_stale_requests(),
--                                    anonymise_old_requests(),
--                                    preview_closure_conflicts(), and the
--                                    revoke/grant pairs that go with them.
--   patch-02-enum-status-cast        the text -> enum casts in
--                                    decide_access_request() and
--                                    approve_request().
--
-- A database that already had them applied needs nothing; a fresh one gets
-- them from this file.
--
-- Re-runnable. Every statement is `if not exists` / `or replace` /
-- `drop ... if exists`, so running it twice is a no-op rather than an error.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN:
--  1. PART 0 below DROPS every table/function/type this script owns, so the
--     rest of the file always starts from a clean slate — safe to re-run
--     regardless of what state the target database is currently in. THIS IS
--     DESTRUCTIVE: it deletes all data in those tables (auth.users itself is
--     untouched). Do not run against a database holding real bookings.
--  2. Check the super admin email at the bottom, under "PART 4 — BOOTSTRAP".
--     §2 says the super admin tier is bootstrapped, not granted; no UI can
--     create the first one.
-- ---------------------------------------------------------------------------
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
-- PART 0 — RESET
-- Drops everything PART 1-4 create, in FK-safe order, so this script is
-- re-runnable against a database in ANY prior state (empty, partially
-- applied, or shaped by an older version of this schema) without hitting
-- "already exists" on an object whose definition changed underneath it —
-- which is exactly what happened to `events_no_overlap`: Postgres raises
-- 42P07 (duplicate_table) for a colliding EXCLUDE-constraint index, not
-- 42710 (duplicate_object), so `exception when duplicate_object` never
-- caught it on a second run.
-- ===========================================================================
-- ===========================================================================

drop table if exists notification_log   cascade;
drop table if exists rate_limits        cascade;
drop table if exists push_subscriptions cascade;
drop table if exists audit_log          cascade;
drop table if exists events             cascade;
drop table if exists recurring_rules    cascade;
drop table if exists booking_requests   cascade;
drop table if exists closures           cascade;
drop table if exists site_settings      cascade;
drop table if exists access_requests    cascade;
drop table if exists trustees           cascade;
drop table if exists admin_profiles     cascade;
drop table if exists admin_allowlist    cascade;

drop function if exists preview_closure_conflicts(timestamptz, timestamptz) cascade;
drop function if exists create_closure(text, timestamptz, timestamptz, boolean, boolean) cascade;
drop function if exists materialize_recurring(int) cascade;
drop function if exists anonymise_old_requests(int) cascade;
drop function if exists expire_stale_requests() cascade;
drop function if exists cancel_request_admin(uuid, int, text) cascade;
drop function if exists delete_request(uuid, int) cascade;
drop function if exists delete_request(uuid) cascade;
drop function if exists reject_request(uuid, int, text) cascade;
-- Both signatures: Postgres overloads on the argument list, so the five-argument
-- version that predates `p_show_note` is a separate function. Left in place
-- beside the six-argument one it would make `approve_request(...)` ambiguous
-- for every caller that omits the new flag.
drop function if exists approve_request(uuid, int, timestamptz, timestamptz, text, boolean) cascade;
drop function if exists approve_request(uuid, int, timestamptz, timestamptz, text) cascade;
drop function if exists decide_access_request(uuid, boolean, admin_role, text) cascade;
drop function if exists add_manager(citext, text, admin_role) cascade;
drop function if exists set_manager_role(uuid, admin_role, boolean) cascade;
drop function if exists my_allowlist_id() cascade;
drop function if exists is_super_admin() cascade;
drop function if exists is_admin() cascade;
drop function if exists touch_updated_at() cascade;
drop function if exists assert_opening_hours_shape() cascade;
drop function if exists assert_super_admin_survives() cascade;

drop type if exists access_request_status;
drop type if exists admin_role;
drop type if exists event_source;
drop type if exists event_status;
drop type if exists request_status;
drop type if exists usage_type;


-- ===========================================================================
-- ===========================================================================
-- PART 1 — SCHEMA
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
    'association'      -- שימוש עמותה
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

do $$ begin
  create type access_request_status as enum ('pending', 'approved', 'rejected');
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
-- Self-service access requests. A row here grants NOTHING on its own —
-- approving one is what writes admin_allowlist, via decide_access_request()
-- in PART 2, which is super-admin-only and audited like every other
-- privileged write.
-- ---------------------------------------------------------------------------
create table if not exists access_requests (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null,
  full_name     text,
  -- 'google' | 'password'. Kept as text rather than an enum: it mirrors
  -- whatever Supabase Auth reports, and a new provider must not need a
  -- migration before a person can ask for access.
  provider      text not null default 'password',
  user_id       uuid references auth.users(id) on delete set null,
  status        access_request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users(id),
  decided_note  text
);

-- One live request per address. A second sign-in attempt while pending must
-- update the existing row rather than filling the queue with duplicates, and a
-- rejected person may ask again later.
create unique index if not exists access_requests_pending_email_idx
  on access_requests (email) where status = 'pending';

create index if not exists access_requests_status_idx
  on access_requests (status, created_at desc);

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
  -- The note the requester typed on the public form, copied here by
  -- approve_request() so the public detail sheet can show it beneath the
  -- description. `booking_requests` has no anon read policy (PART 3), so an
  -- event row is the only way that text can ever reach a visitor.
  requester_note  text,
  -- Whether that note is published. Off by default and flipped by an admin,
  -- exactly like `show_contact` below: the requester wrote it for the people
  -- deciding on the booking, not for the public calendar, so nothing they type
  -- reaches a visitor until a manager says so.
  show_note       boolean not null default false,
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

-- Hard guarantee (G4): no two live events of the SAME category overlap.
-- Association and community may share a slot (one of each, at once); two
-- bookings of the same category still cannot double-book.
do $$ begin
  alter table events add constraint events_no_overlap
    exclude using gist (
      usage_type with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status = 'scheduled');
exception when duplicate_object then null; end $$;

-- PART 0 drops `events` before this file recreates it, so the column above is
-- always there on a fresh run. This line is what a LIVE database needs: run it,
-- plus the `approve_request` replacement further down, to pick the column up
-- without resetting the schema.
alter table events add column if not exists requester_note text;
alter table events add column if not exists show_note boolean not null default false;

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
-- Every guarded mutation is a `security definer` RPC so that the invariants
-- of §2 cannot be bypassed by writing to a table directly.
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

-- Is this call coming from the service role (the cron routes and the public
-- write surface), rather than from a signed-in person?
--
-- Needed because `is_admin()` resolves `auth.uid()` against the allowlist, and
-- the service role has no `auth.uid()` at all — so a plain `is_admin()` guard
-- on a maintenance function would lock out the very cron job that is supposed
-- to run it. Reads the JWT role claim PostgREST sets, so it is true only for a
-- caller presenting the service-role key, which never reaches the browser
-- (§7, lib/supabase/admin.ts).
-- `nullif(..., '')` before the cast is load-bearing: current_setting's
-- missing_ok form yields NULL when the GUC was never set, but an empty STRING
-- when it was set and cleared, and `''::jsonb` raises rather than returning
-- null — which would turn every call into an error instead of a false.
create or replace function is_service_role() returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
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
-- Access requests. Decision is the ONLY path from a request to an
-- allowlist row; a pending row grants nothing on its own.
-- ---------------------------------------------------------------------------
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

  -- The cast is load-bearing. A `case` whose branches are all bare literals
  -- resolves to `text`, and Postgres has no implicit text -> enum assignment
  -- cast, so without it this raises 42804 ("column is of type
  -- access_request_status but expression is of type text") and every approval
  -- fails. A single bare literal (`set status = 'rejected'`) is fine — that one
  -- stays `unknown` and is coerced to the column's type — which is why only the
  -- two `case` assignments in this file need it.
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

-- ---------------------------------------------------------------------------
-- Approval workflow (§4.3, §5)
-- ---------------------------------------------------------------------------
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

-- Housekeeping, not a decision: removes a row outright (spam, duplicates,
-- test submissions), regardless of status — unlike reject/cancel, which
-- record an outcome and keep the row. The FK on `events.request_id` is
-- `on delete set null`, so if the request was ever approved, its event
-- survives on the schedule with its link to this row cleared rather than
-- being pulled down as a side effect of deleting the request.
--
-- `p_version` still guards it, same as approve/reject/cancel_admin: without
-- it, one admin could delete a row a second admin just decided a moment
-- earlier with no signal that the state changed underneath them.
create or replace function delete_request(p_request_id uuid, p_version int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r booking_requests;
begin
  if not is_admin() then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  select * into r from booking_requests where id = p_request_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if r.version <> p_version then raise exception 'ERR_STALE'; end if;

  delete from booking_requests where id = r.id;

  insert into audit_log (actor_id, entity, entity_id, action, before, after)
  values (auth.uid(), 'booking_request', r.id, 'delete', to_jsonb(r), null);
end;
$$;

-- FR-26: pending requests older than the requested date auto-expire.
create or replace function expire_stale_requests()
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  -- `security definer` bypasses RLS, and EXECUTE reaches every signed-in
  -- user — and signing up is open to the public (§ /api/auth/sign-up), so
  -- "authenticated" is not a trusted set. Without this, any stranger who
  -- confirmed an email address could expire the pending queue by calling
  -- the RPC straight against PostgREST.
  if not (is_admin() or is_service_role()) then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

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
  -- Same exposure as expire_stale_requests() above, but destructive and
  -- irreversible: this overwrites requester name, phone and note in place.
  if not (is_admin() or is_service_role()) then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  -- The retention window is a caller-supplied parameter, so it is also the
  -- payload. `p_months => 0` (or a negative value) turns "anonymise records
  -- older than two years" into "anonymise every terminal record there has
  -- ever been" in a single call. Clamped to a floor rather than trusted:
  -- there is no legitimate reason to scrub anything younger than a month.
  if p_months is null or p_months < 1 then
    raise exception 'ERR_VALIDATION';
  end if;

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
  -- Unlike the two functions above this one IS called with a signed-in
  -- session (the admin recurring-rules screen), so `authenticated` keeps its
  -- EXECUTE grant and the check has to live here.
  if not (is_admin() or is_service_role()) then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  -- The horizon drives the week-stepping loop below, once per active rule.
  -- Left unbounded it is a cheap denial of service — a single call with a
  -- horizon of a few hundred thousand days spins the loop tens of thousands
  -- of times per rule, each iteration attempting an INSERT — and it would
  -- also flood the public calendar. 400 days comfortably covers the 120-day
  -- horizon the callers actually pass.
  if p_horizon_days is null or p_horizon_days < 1 or p_horizon_days > 400 then
    raise exception 'ERR_VALIDATION';
  end if;

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
-- Admin-gated even though it only reads: `returns setof events` hands back the
-- WHOLE row, and `security definer` means RLS never trims it. That includes
-- `contact_phone` and `contact_name`, which the public schedule deliberately
-- withholds unless `show_contact` is set (§7 PII, `toPublicEvent` in
-- lib/types.ts). Without this guard, widening the range to a century turns a
-- confirmation-dialog helper into a dump of every contact number on file.
create or replace function preview_closure_conflicts(
  p_starts_at timestamptz,
  p_ends_at   timestamptz
) returns setof events
language sql stable security definer set search_path = public as $$
  select * from events
   where (select is_admin() or is_service_role())
     and status = 'scheduled'
     and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
   order by starts_at;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The anon role may only call the availability helper; everything else
-- is either admin-gated inside the function or proxied by the server.
-- ---------------------------------------------------------------------------
revoke all on function set_manager_role(uuid, admin_role, boolean) from public, anon;
revoke all on function add_manager(citext, text, admin_role) from public, anon;
revoke all on function expire_stale_requests() from public, anon;
revoke all on function anonymise_old_requests(int) from public, anon;
revoke all on function materialize_recurring(int) from public, anon;
revoke all on function create_closure(text, timestamptz, timestamptz, boolean, boolean) from public, anon;
revoke all on function preview_closure_conflicts(timestamptz, timestamptz) from public, anon;
revoke all on function approve_request(uuid, int, timestamptz, timestamptz, text, boolean) from public, anon;
revoke all on function reject_request(uuid, int, text) from public, anon;
revoke all on function cancel_request_admin(uuid, int, text) from public, anon;
revoke all on function delete_request(uuid, int) from public, anon;

grant execute on function approve_request(uuid, int, timestamptz, timestamptz, text, boolean) to authenticated;
grant execute on function reject_request(uuid, int, text) to authenticated;
grant execute on function cancel_request_admin(uuid, int, text) to authenticated;
grant execute on function delete_request(uuid, int) to authenticated;
grant execute on function set_manager_role(uuid, admin_role, boolean) to authenticated;
grant execute on function add_manager(citext, text, admin_role) to authenticated;
grant execute on function create_closure(text, timestamptz, timestamptz, boolean, boolean) to authenticated;
grant execute on function preview_closure_conflicts(timestamptz, timestamptz) to authenticated;
-- Called from the admin recurring-rules screen with a signed-in session, so
-- this one keeps its `authenticated` grant; the guard is inside the function.
grant execute on function materialize_recurring(int) to authenticated;

-- Maintenance, invoked ONLY by the cron routes with the service-role key
-- (app/api/cron/*). Nothing in the product calls them with a user session, so
-- `authenticated` has no business holding EXECUTE — the internal guards added
-- above are the belt, this is the braces. Signing up is open to the public,
-- which makes `authenticated` an untrusted set (§ /api/auth/sign-up).
revoke execute on function anonymise_old_requests(int) from authenticated;
revoke execute on function expire_stale_requests() from authenticated;
grant execute on function anonymise_old_requests(int) to service_role;
grant execute on function expire_stale_requests() to service_role;
grant execute on function materialize_recurring(int) to service_role;

grant execute on function is_admin() to authenticated, anon;
grant execute on function is_super_admin() to authenticated, anon;
grant execute on function is_service_role() to authenticated, anon;


-- ===========================================================================
-- ===========================================================================
-- PART 3 — ROW LEVEL SECURITY
-- RLS is enabled on EVERY table. The public site reads with the anon key;
-- all public writes go through server-side route handlers using the service
-- role key, never directly from the browser.
-- ===========================================================================
-- ===========================================================================

alter table events             enable row level security;
alter table trustees           enable row level security;
alter table closures           enable row level security;
alter table booking_requests   enable row level security;
alter table recurring_rules    enable row level security;
alter table admin_allowlist    enable row level security;
alter table admin_profiles     enable row level security;
alter table access_requests    enable row level security;
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

drop policy if exists recurring_public_read on recurring_rules;
create policy recurring_public_read on recurring_rules
  for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Booking requests: NO anon access at all. The public submits through the
-- server (service role) only; there is no requester-facing status page any
-- more, so there is no public read path to this table (§ request flow
-- revision).
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

-- Admins read the access-request queue; only the RPC writes it. The insert on
-- sign-up is done server-side with the service role, because the person
-- making it is by definition not an admin yet.
drop policy if exists access_requests_admin_read on access_requests;
create policy access_requests_admin_read on access_requests
  for select to authenticated using (is_admin());
-- Deliberately NO insert/update/delete policy for anon or authenticated.

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
-- PART 3B — STORAGE
-- A trustee's photo (app/api/admin/trustees/[id]/photo). Public bucket: the
-- photo is shown on the public site, so anon read is intentional — the same
-- shape as `trustees_public_read` above. Only an admin may upload, replace or
-- remove a file, reusing the same `is_admin()` predicate as every other
-- admin-write policy in this file.
-- ===========================================================================
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('trustee-photos', 'trustee-photos', true)
on conflict (id) do nothing;

drop policy if exists trustee_photos_public_read on storage.objects;
create policy trustee_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'trustee-photos');

drop policy if exists trustee_photos_admin_write on storage.objects;
create policy trustee_photos_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'trustee-photos' and is_admin())
  with check (bucket_id = 'trustee-photos' and is_admin());


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

-- >>> CHECK THIS EMAIL BEFORE RUNNING <<<
-- Must match the address you will sign in with (Google OAuth). Re-running
-- with a different email adds a second super admin; it does not replace the
-- first. Prefilled with the address on this session's context — change it if
-- that isn't who should be super admin.
do $$
declare
  v_super_admin_email citext := 'shacharassen3667@gmail.com';
  v_super_admin_name  text   := 'מנהל על';
begin
  insert into admin_allowlist (email, full_name, role)
  values (v_super_admin_email, v_super_admin_name, 'super_admin')
  on conflict (email) do update
    set role = 'super_admin',
        revoked_at = null;
end $$;

-- Pitch name, opening hours and request limits used to live in a
-- super-admin-editable `site_settings` row here. They are fixed values in
-- code now (`lib/types.ts`, `SITE_SETTINGS`) — nothing left to bootstrap.
