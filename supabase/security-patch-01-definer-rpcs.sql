-- ===========================================================================
-- SECURITY PATCH 01 — authorization on `security definer` maintenance RPCs
--
-- Apply to the LIVE database (Supabase dashboard → SQL editor). Idempotent:
-- every statement is `create or replace` / `revoke` / `grant`, so re-running
-- it is a no-op. These same changes are already folded into init.sql, so a
-- fresh deployment needs nothing extra.
--
-- WHAT WAS WRONG
-- --------------
-- Four functions were declared `security definer` — meaning they execute with
-- the definer's rights and RLS does not apply to them — and were granted
-- EXECUTE to `authenticated`, with NO authorization check in their bodies.
--
-- `authenticated` is not a trusted set in this product. Sign-up is open to
-- the public (POST /api/auth/sign-up), and while the application's own
-- sign-in and OAuth callback correctly destroy the session of anyone who is
-- not on the allowlist, that only governs the application's routes. The anon
-- key is public by design, so anyone who registers and confirms an address
-- can obtain a JWT straight from GoTrue and call PostgREST directly at
-- /rest/v1/rpc/<name>, never touching the app.
--
-- Impact per function, before this patch:
--   anonymise_old_requests  irreversible destruction of requester name, phone
--                           and note on every terminal booking request. The
--                           retention window is a caller-supplied parameter,
--                           so `p_months => 0` scrubs the entire table.
--   materialize_recurring   unbounded loop driven by a caller-supplied
--                           horizon: denial of service plus mass event
--                           creation on the public calendar.
--   expire_stale_requests   unauthorized state change over the pending queue.
--   preview_closure_conflicts  returns whole `events` rows, so it disclosed
--                           contact_name / contact_phone that the public
--                           schedule deliberately redacts (§7 PII).
-- ===========================================================================

-- The cron routes call these with the service-role key and therefore have no
-- `auth.uid()`, so a plain is_admin() guard would lock out the scheduled jobs.
-- `nullif(..., '')` before the cast: current_setting's missing_ok form yields
-- NULL when unset but an empty STRING when set-and-cleared, and `''::jsonb`
-- raises rather than returning null.
create or replace function is_service_role() returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

grant execute on function is_service_role() to authenticated, anon;


create or replace function expire_stale_requests()
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
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


create or replace function anonymise_old_requests(p_months int default 24)
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not (is_admin() or is_service_role()) then
    raise exception 'ERR_NOT_AUTHORIZED';
  end if;

  -- The window is the payload: `p_months => 0` would scrub everything.
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


-- Read-only, but `returns setof events` + `security definer` means RLS never
-- trims the row: contact_phone and contact_name came back in full.
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


-- NOTE: materialize_recurring() is NOT redefined here — its body is long and
-- unchanged apart from the two checks below, so it is patched in place from
-- init.sql. If you are applying this file to a database that predates the
-- change, re-run the `create or replace function materialize_recurring(...)`
-- block from supabase/init.sql, which now begins with:
--
--   if not (is_admin() or is_service_role()) then
--     raise exception 'ERR_NOT_AUTHORIZED';
--   end if;
--   if p_horizon_days is null or p_horizon_days < 1 or p_horizon_days > 400 then
--     raise exception 'ERR_VALIDATION';
--   end if;


-- Defence in depth on top of the in-function guards: the two cron-only
-- functions are not called with a user session anywhere in the product, so
-- `authenticated` should not hold EXECUTE at all.
revoke execute on function anonymise_old_requests(int) from authenticated;
revoke execute on function expire_stale_requests() from authenticated;

grant execute on function anonymise_old_requests(int) to service_role;
grant execute on function expire_stale_requests() to service_role;
grant execute on function materialize_recurring(int) to service_role;


-- ===========================================================================
-- VERIFY (safe, non-destructive)
--
-- 1. As an ordinary signed-in NON-admin (a freshly registered account),
--    against PostgREST:
--       POST /rest/v1/rpc/anonymise_old_requests   {"p_months": 0}
--    Expect: 403 / "permission denied for function" (grant removed).
--       POST /rest/v1/rpc/materialize_recurring    {"p_horizon_days": 999999}
--    Expect: ERR_NOT_AUTHORIZED  (and ERR_VALIDATION even for an admin).
--       POST /rest/v1/rpc/preview_closure_conflicts {...wide range...}
--    Expect: zero rows.
--
-- 2. As an admin: the recurring-rules screen must still save and materialise.
-- 3. As cron: GET /api/cron/expire, /anonymise, /materialize with the
--    CRON_SECRET bearer token must still return their usual counts.
-- ===========================================================================
