-- ===========================================================================
-- 0002 — Self-service access requests
--
-- §2 originally had no signup path at all: an email was put on
-- `admin_allowlist` by a super admin, and being on that list WAS the
-- invitation. This migration adds the other direction — a person can ask for
-- access, and a super admin grants or refuses it — without weakening the rule
-- that the allowlist is the only thing that grants anything.
--
-- The gate is unchanged: `is_admin()` still reads `admin_allowlist`. A row in
-- `access_requests` grants NOTHING on its own. Approving one is what writes the
-- allowlist row, and that happens inside `decide_access_request()`, which is
-- super-admin-only and audited like every other privileged write.
-- ===========================================================================

create type access_request_status as enum ('pending', 'approved', 'rejected');

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
-- Decision. Super admin only, audited, and the ONLY path from a request to an
-- allowlist row.
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

  update access_requests
     set status       = case when p_approve then 'approved' else 'rejected' end,
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
-- RLS. Admins read the queue; only the RPC writes it. The insert on sign-up is
-- done server-side with the service role, because the person making it is by
-- definition not an admin yet.
-- ---------------------------------------------------------------------------
alter table access_requests enable row level security;

drop policy if exists access_requests_admin_read on access_requests;
create policy access_requests_admin_read on access_requests
  for select to authenticated using (is_admin());
-- Deliberately NO insert/update/delete policy for anon or authenticated.
