-- ===========================================================================
-- Migrash Gilad — deterministic local seed data.
--
-- Applied after the single schema migration by `supabase start` and
-- `supabase db reset`. It contains public pitch data only: no booking
-- requests, administrator emails, audit history, rate limits, notification
-- payloads, or push credentials.
-- ===========================================================================

begin;

-- Trustees (§4.4). These names and phone numbers are already public on the
-- website; no private contact details are included here.
insert into trustees (
  id,
  full_name,
  title,
  phone_e164,
  whatsapp_ok,
  photo_url,
  display_order,
  is_primary,
  is_available,
  is_archived
)
values
  (
    '4bd62b6b-bb83-4f29-bc11-81a394b9ca98',
    'שחר אסנהיים',
    null,
    '+972533402610',
    true,
    'https://cogrstmadrjwwrsuudyc.supabase.co/storage/v1/object/public/trustee-photos/4bd62b6b-bb83-4f29-bc11-81a394b9ca98.jpg?v=1786641296263',
    0,
    false,
    true,
    false
  ),
  (
    'ec8f6d00-353d-4657-bfaa-2900234d4b79',
    'נדב פיכמן',
    null,
    '+972523743912',
    true,
    null,
    2,
    false,
    true,
    false
  ),
  (
    '46b902b3-b1eb-43d6-a08d-fab778b9e3ab',
    'רותם אסנהיים',
    null,
    '+972544649176',
    true,
    null,
    3,
    false,
    true,
    false
  ),
  (
    '60771f1a-7dcc-46b3-9d90-219c7ea41c2b',
    'גילעד פיכמן',
    null,
    '+972545690032',
    true,
    null,
    4,
    false,
    true,
    false
  )
on conflict (id) do nothing;

-- Standing weekly allocations (FR-34). The materializer below creates the
-- rolling schedule, so the seed does not need a stale snapshot of every
-- derived event.
insert into recurring_rules (
  id,
  title,
  usage_type,
  weekday,
  start_time,
  end_time,
  valid_from,
  valid_until,
  is_active,
  contact_name,
  created_by
)
values
  (
    '4cc35722-3c25-4642-84a2-eb4e32c34cd5',
    'חוג כדורגל',
    'association',
    0,
    '16:00:00',
    '19:00:00',
    '2026-08-09',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    '0378d820-8a64-4578-83a0-c01d79428261',
    'חוג כדורגל',
    'association',
    1,
    '16:00:00',
    '20:00:00',
    '2026-08-10',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8',
    'זמן קהילה',
    'community',
    2,
    '16:00:00',
    '21:00:00',
    '2026-08-18',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3',
    'מצויינות אישית',
    'association',
    2,
    '16:00:00',
    '21:00:00',
    '2026-08-18',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0',
    'חוג כדורגל',
    'association',
    3,
    '16:00:00',
    '19:00:00',
    '2026-08-19',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    'dc312750-f63f-45bf-839a-ea378ffaa9ae',
    'חוג כדורגל',
    'association',
    4,
    '17:00:00',
    '19:00:00',
    '2026-08-20',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    '8ec0d877-77f3-4c17-983e-59c61c8c929f',
    'זמן קהילה',
    'community',
    4,
    '17:00:00',
    '19:00:00',
    '2026-08-20',
    '2027-08-01',
    true,
    null,
    null
  ),
  (
    '878c4410-e024-46f8-8f42-4177446de546',
    'מצויינות אישית',
    'association',
    5,
    '07:00:00',
    '12:00:00',
    '2026-08-21',
    '2027-08-01',
    true,
    null,
    null
  )
on conflict (id) do nothing;

-- The RPC is protected for application callers. Seed execution runs directly
-- in Postgres, so scope a service-role claim to this transaction only.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select materialize_recurring(120);

-- To grant yourself local admin access, add a row from Studio after signing
-- in. Real administrator addresses never belong in committed seed data.

commit;
