-- ===========================================================================
-- Migrash Gilad — seed data. Run AFTER supabase/init.sql.
--
-- This is a SNAPSHOT of the live database taken on 2026-08-18, not invented
-- sample data: the trustees, the standing allocations and the schedule are the
-- real ones, so a local database looks like production rather than like a
-- demo.
--
-- WHAT IS NOT HERE, and why:
--
--   booking_requests   A resident's name, phone and `public_token` — the token
--                      is a bearer credential for their request. None of it
--                      belongs in a file that is committed and pushed.
--   admin_allowlist    Real administrators' email addresses. Add your own at
--   admin_profiles     the bottom of this file instead (there is a commented
--   access_requests    template) — that is also what makes /admin reachable
--                      locally.
--   audit_log          A record of who did what, and notification payloads
--   notification_log   carrying addresses and phone numbers. History, not seed.
--   rate_limits        Runtime counters; meaningless outside their own window.
--   push_subscriptions Device push credentials (empty in the snapshot anyway).
--
-- Event contact phones are carried ONLY where `show_contact` is true, i.e.
-- where the number is already published on the public calendar.
--
-- Rows keep their production ids, so `events.recurring_id` still points at the
-- rule that generated it, and re-running the file is a no-op (`on conflict do
-- nothing`) rather than a duplicate schedule.
--
-- Dates are absolute, as they are in production. The standing allocations
-- below keep generating fresh occurrences on their own, so the calendar in a
-- seeded database stays populated going forward:
--
--   select materialize_recurring(120);
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trustees (§4.4). Public information — this is what the site itself shows.
-- ---------------------------------------------------------------------------
insert into trustees (id, full_name, title, phone_e164, whatsapp_ok, photo_url, display_order, is_primary, is_available, is_archived)
values
  ('4bd62b6b-bb83-4f29-bc11-81a394b9ca98', 'שחר אסנהיים', null, '+972533402610', true, 'https://cogrstmadrjwwrsuudyc.supabase.co/storage/v1/object/public/trustee-photos/4bd62b6b-bb83-4f29-bc11-81a394b9ca98.jpg?v=1786641296263', 0, false, true, false),
  ('ec8f6d00-353d-4657-bfaa-2900234d4b79', 'נדב פיכמן', null, '+972523743912', true, null, 2, false, true, false),
  ('46b902b3-b1eb-43d6-a08d-fab778b9e3ab', 'רותם אסנהיים', null, '+972544649176', true, null, 3, false, true, false),
  ('60771f1a-7dcc-46b3-9d90-219c7ea41c2b', 'גילעד פיכמן', null, '+972545690032', true, null, 4, false, true, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Standing weekly allocations (FR-34). `materialize_recurring` turns these
-- into the occurrences below, and keeps doing so for future weeks.
-- ---------------------------------------------------------------------------
insert into recurring_rules (id, title, usage_type, weekday, start_time, end_time, valid_from, valid_until, is_active, contact_name, created_by)
values
  ('4cc35722-3c25-4642-84a2-eb4e32c34cd5', 'חוג כדורגל', 'association', 0, '16:00:00', '19:00:00', '2026-08-09', '2027-08-01', true, null, null),
  ('0378d820-8a64-4578-83a0-c01d79428261', 'חוג כדורגל', 'association', 1, '16:00:00', '20:00:00', '2026-08-10', '2027-08-01', true, null, null),
  ('a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', 'זמן קהילה', 'community', 2, '16:00:00', '21:00:00', '2026-08-18', '2027-08-01', true, null, null),
  ('f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', 'מצויינות אישית', 'association', 2, '16:00:00', '21:00:00', '2026-08-18', '2027-08-01', true, null, null),
  ('bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', 'חוג כדורגל', 'association', 3, '16:00:00', '19:00:00', '2026-08-19', '2027-08-01', true, null, null),
  ('dc312750-f63f-45bf-839a-ea378ffaa9ae', 'חוג כדורגל', 'association', 4, '17:00:00', '19:00:00', '2026-08-20', '2027-08-01', true, null, null),
  ('8ec0d877-77f3-4c17-983e-59c61c8c929f', 'זמן קהילה', 'community', 4, '17:00:00', '19:00:00', '2026-08-20', '2027-08-01', true, null, null),
  ('878c4410-e024-46f8-8f42-4177446de546', 'מצויינות אישית', 'association', 5, '07:00:00', '12:00:00', '2026-08-21', '2027-08-01', true, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The schedule itself: 141 events, both the hand-entered ones and the
-- occurrences generated from the rules above. `occurrence_date` travels with
-- them so a later `materialize_recurring` does not create a second copy.
-- ---------------------------------------------------------------------------
insert into events (id, title, description, usage_type, starts_at, ends_at, status, source, request_id, recurring_id, occurrence_date, contact_name, contact_phone, show_contact, created_by)
values
  ('ac697e76-62ec-4833-b7bb-e971adb51185', 'חוג כדורגל', null, 'association', '2026-08-16T13:00:00+00:00', '2026-08-16T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-08-16', null, null, false, null),
  ('7a33a43a-5058-4093-bb06-55629296f590', 'חוג כדורגל', null, 'association', '2026-08-17T13:00:00+00:00', '2026-08-17T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-08-17', null, null, false, null),
  ('d1f4fc2d-a744-42ba-8479-5fbe022eddfa', 'זמן קהילה', null, 'community', '2026-08-18T13:00:00+00:00', '2026-08-18T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-08-18', null, null, false, null),
  ('a318e3f3-9066-4ac5-b61b-c6d1164bec33', 'מצויינות אישית', null, 'association', '2026-08-18T13:00:00+00:00', '2026-08-18T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-08-18', null, null, false, null),
  ('0999f8bf-886e-4e51-9923-822029e2b1b2', 'חוג כדורגל', null, 'association', '2026-08-19T13:00:00+00:00', '2026-08-19T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-08-19', null, null, false, null),
  ('6f0d43ea-b35d-4d95-8a2f-f036a35c1837', 'חוג כדורגל', null, 'association', '2026-08-20T14:00:00+00:00', '2026-08-20T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-08-20', null, null, false, null),
  ('a9b5be04-af80-4707-a604-ccc884e98d48', 'זמן קהילה', null, 'community', '2026-08-20T14:00:00+00:00', '2026-08-20T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-08-20', null, null, false, null),
  ('12f40edc-5339-4c8e-9a64-06039391b0b9', 'מצויינות אישית', null, 'association', '2026-08-21T04:00:00+00:00', '2026-08-21T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-08-21', null, null, false, null),
  ('8fea0c33-aa87-4610-a284-ad1124e2f3b5', 'חוג כדורגל', null, 'association', '2026-08-23T13:00:00+00:00', '2026-08-23T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-08-23', null, null, false, null),
  ('a29cc236-87b5-4ca1-9ad9-d4d66ab579a0', 'חוג כדורגל', null, 'association', '2026-08-24T13:00:00+00:00', '2026-08-24T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-08-24', null, null, false, null),
  ('2fc694f1-956b-4f2d-a07e-ed9a2703f45a', 'זמן קהילה', null, 'community', '2026-08-25T13:00:00+00:00', '2026-08-25T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-08-25', null, null, false, null),
  ('4e11c5d4-cbb7-4a56-8e41-93c03ca6d8a4', 'מצויינות אישית', null, 'association', '2026-08-25T13:00:00+00:00', '2026-08-25T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-08-25', null, null, false, null),
  ('c7cce09a-cfe7-4c2d-8e36-7e461bfdb3ff', 'חוג כדורגל', null, 'association', '2026-08-26T13:00:00+00:00', '2026-08-26T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-08-26', null, null, false, null),
  ('d54e7412-c2a8-47d2-957f-07cc93d0b982', 'זמן קהילה', null, 'community', '2026-08-27T14:00:00+00:00', '2026-08-27T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-08-27', null, null, false, null),
  ('bd559ebe-7942-4d31-8d52-cf2db034d341', 'חוג כדורגל', null, 'association', '2026-08-27T14:00:00+00:00', '2026-08-27T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-08-27', null, null, false, null),
  ('e60de950-8d4f-492b-b65c-e7c7b7e154e5', 'מצויינות אישית', null, 'association', '2026-08-28T04:00:00+00:00', '2026-08-28T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-08-28', null, null, false, null),
  ('0c8789d4-151d-4bfb-8b2d-8c1bc0b903d3', 'חוג כדורגל', null, 'association', '2026-08-30T13:00:00+00:00', '2026-08-30T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-08-30', null, null, false, null),
  ('dc805220-466d-4ef6-8921-8f71fe1bb29c', 'חוג כדורגל', null, 'association', '2026-08-31T13:00:00+00:00', '2026-08-31T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-08-31', null, null, false, null),
  ('1da47669-ff91-4590-8fd9-5edcf0ee7040', 'זמן קהילה', null, 'community', '2026-09-01T13:00:00+00:00', '2026-09-01T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-09-01', null, null, false, null),
  ('14a6f534-928a-4d9e-a124-941e54cbd000', 'מצויינות אישית', null, 'association', '2026-09-01T13:00:00+00:00', '2026-09-01T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-09-01', null, null, false, null),
  ('f0e18f30-1ebc-49cd-af23-93e43affe6c2', 'חוג כדורגל', null, 'association', '2026-09-02T13:00:00+00:00', '2026-09-02T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-09-02', null, null, false, null),
  ('46c629d2-055b-45da-abb6-6dff192622d9', 'זמן קהילה', null, 'community', '2026-09-03T14:00:00+00:00', '2026-09-03T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-09-03', null, null, false, null),
  ('b42a6a00-f095-44dd-87db-7a77eabc41c8', 'חוג כדורגל', null, 'association', '2026-09-03T14:00:00+00:00', '2026-09-03T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-09-03', null, null, false, null),
  ('ba64039a-5269-49b4-b061-5f4306a09f5c', 'מצויינות אישית', null, 'association', '2026-09-04T04:00:00+00:00', '2026-09-04T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-09-04', null, null, false, null),
  ('cd5d652f-4749-4ed6-8c18-7f7cea2b2dc8', 'חוג כדורגל', null, 'association', '2026-09-06T13:00:00+00:00', '2026-09-06T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-09-06', null, null, false, null),
  ('a2599adb-35c3-4f1e-9e53-b9d887d5163f', 'חוג כדורגל', null, 'association', '2026-09-07T13:00:00+00:00', '2026-09-07T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-09-07', null, null, false, null),
  ('45c5fa0d-8473-4457-9e78-aecf50eb35ce', 'מצויינות אישית', null, 'association', '2026-09-08T13:00:00+00:00', '2026-09-08T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-09-08', null, null, false, null),
  ('a8405572-1f67-4362-8feb-c4b7269747b8', 'זמן קהילה', null, 'community', '2026-09-08T13:00:00+00:00', '2026-09-08T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-09-08', null, null, false, null),
  ('5bac75f7-b5ee-46e1-bf42-47a3d67e4aea', 'חוג כדורגל', null, 'association', '2026-09-09T13:00:00+00:00', '2026-09-09T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-09-09', null, null, false, null),
  ('71e4bc79-6f57-4f3a-a385-e247aed0373f', 'זמן קהילה', null, 'community', '2026-09-10T14:00:00+00:00', '2026-09-10T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-09-10', null, null, false, null),
  ('f548bc2e-7efb-4278-87d9-a94d712327b3', 'חוג כדורגל', null, 'association', '2026-09-10T14:00:00+00:00', '2026-09-10T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-09-10', null, null, false, null),
  ('dfd6196d-fedc-43d5-b9f4-bf3884961f5a', 'מצויינות אישית', null, 'association', '2026-09-11T04:00:00+00:00', '2026-09-11T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-09-11', null, null, false, null),
  ('94a4319c-f799-482c-8c17-312dfd80dc0d', 'חוג כדורגל', null, 'association', '2026-09-13T13:00:00+00:00', '2026-09-13T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-09-13', null, null, false, null),
  ('3819ec20-2c4c-4f08-b4e3-bb5e568ce62e', 'חוג כדורגל', null, 'association', '2026-09-14T13:00:00+00:00', '2026-09-14T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-09-14', null, null, false, null),
  ('c5a39043-4a72-4c25-94f7-5c80f028797e', 'מצויינות אישית', null, 'association', '2026-09-15T13:00:00+00:00', '2026-09-15T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-09-15', null, null, false, null),
  ('fc5f944b-725a-4978-9b56-bb2a451dd515', 'זמן קהילה', null, 'community', '2026-09-15T13:00:00+00:00', '2026-09-15T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-09-15', null, null, false, null),
  ('e489e5cb-19da-4ddf-a64b-6d3c54028c4b', 'חוג כדורגל', null, 'association', '2026-09-16T13:00:00+00:00', '2026-09-16T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-09-16', null, null, false, null),
  ('fcb6c985-1c04-482b-9b86-0c73031318f7', 'חוג כדורגל', null, 'association', '2026-09-17T14:00:00+00:00', '2026-09-17T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-09-17', null, null, false, null),
  ('e07ed34f-b877-401d-9c49-5ceaa04b632c', 'זמן קהילה', null, 'community', '2026-09-17T14:00:00+00:00', '2026-09-17T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-09-17', null, null, false, null),
  ('59f9f5ec-daa8-45de-9d9b-e42c1b969717', 'מצויינות אישית', null, 'association', '2026-09-18T04:00:00+00:00', '2026-09-18T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-09-18', null, null, false, null),
  ('c49cff03-cdbf-42f2-ae68-89547a4c5fad', 'חוג כדורגל', null, 'association', '2026-09-20T13:00:00+00:00', '2026-09-20T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-09-20', null, null, false, null),
  ('04b69677-61c4-44ed-a4e9-91e135f80386', 'חוג כדורגל', null, 'association', '2026-09-21T13:00:00+00:00', '2026-09-21T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-09-21', null, null, false, null),
  ('27e112d4-1052-481f-9dfe-e7fa6e47a45b', 'מצויינות אישית', null, 'association', '2026-09-22T13:00:00+00:00', '2026-09-22T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-09-22', null, null, false, null),
  ('e531a009-7f3f-4b34-8f8e-4e41b8a66aae', 'זמן קהילה', null, 'community', '2026-09-22T13:00:00+00:00', '2026-09-22T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-09-22', null, null, false, null),
  ('aba0059d-dbee-4c4f-9892-57041575dba2', 'חוג כדורגל', null, 'association', '2026-09-23T13:00:00+00:00', '2026-09-23T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-09-23', null, null, false, null),
  ('98431054-6d92-4f34-8b09-f468b6bcfa85', 'חוג כדורגל', null, 'association', '2026-09-24T14:00:00+00:00', '2026-09-24T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-09-24', null, null, false, null),
  ('3af3dd6d-7d29-40b4-8797-8636cea25f8c', 'זמן קהילה', null, 'community', '2026-09-24T14:00:00+00:00', '2026-09-24T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-09-24', null, null, false, null),
  ('64a3eb4d-c3d4-40ad-ae84-ead347315b00', 'מצויינות אישית', null, 'association', '2026-09-25T04:00:00+00:00', '2026-09-25T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-09-25', null, null, false, null),
  ('c25f2db8-78f4-4648-9e54-9dad439dc60f', 'חוג כדורגל', null, 'association', '2026-09-27T13:00:00+00:00', '2026-09-27T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-09-27', null, null, false, null),
  ('43dd9518-d09a-4d2f-9bca-d950853fec60', 'חוג כדורגל', null, 'association', '2026-09-28T13:00:00+00:00', '2026-09-28T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-09-28', null, null, false, null),
  ('4db32f63-56cd-4555-8115-69ad031982c2', 'מצויינות אישית', null, 'association', '2026-09-29T13:00:00+00:00', '2026-09-29T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-09-29', null, null, false, null),
  ('0dd4c41d-4d85-43ac-a285-1660b5ee015f', 'זמן קהילה', null, 'community', '2026-09-29T13:00:00+00:00', '2026-09-29T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-09-29', null, null, false, null),
  ('604ba2aa-44c4-4e02-98d0-a41017c2fbb4', 'חוג כדורגל', null, 'association', '2026-09-30T13:00:00+00:00', '2026-09-30T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-09-30', null, null, false, null),
  ('3abeb442-b1e0-4982-bca3-783eda84068c', 'חוג כדורגל', null, 'association', '2026-10-01T14:00:00+00:00', '2026-10-01T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-10-01', null, null, false, null),
  ('2b41f242-5094-4631-8b9e-7621d37b3c24', 'זמן קהילה', null, 'community', '2026-10-01T14:00:00+00:00', '2026-10-01T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-10-01', null, null, false, null),
  ('381c971f-03ad-43ff-91a6-b7eb10876ed5', 'מצויינות אישית', null, 'association', '2026-10-02T04:00:00+00:00', '2026-10-02T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-10-02', null, null, false, null),
  ('fd440d74-ec1e-4911-a976-38ec60279b5f', 'חוג כדורגל', null, 'association', '2026-10-04T13:00:00+00:00', '2026-10-04T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-10-04', null, null, false, null),
  ('f25acaf9-e740-4178-8440-85a2cb7f6ea3', 'חוג כדורגל', null, 'association', '2026-10-05T13:00:00+00:00', '2026-10-05T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-10-05', null, null, false, null),
  ('493e2884-33f3-45c3-9999-da91b18f8051', 'מצויינות אישית', null, 'association', '2026-10-06T13:00:00+00:00', '2026-10-06T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-10-06', null, null, false, null),
  ('0d9cc0ba-3446-499e-8271-4c0d1db4c612', 'זמן קהילה', null, 'community', '2026-10-06T13:00:00+00:00', '2026-10-06T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-10-06', null, null, false, null),
  ('6858f28f-49dc-4769-be74-b513e213a671', 'חוג כדורגל', null, 'association', '2026-10-07T13:00:00+00:00', '2026-10-07T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-10-07', null, null, false, null),
  ('f788cb45-356a-418d-a550-8690b6e93588', 'זמן קהילה', null, 'community', '2026-10-08T14:00:00+00:00', '2026-10-08T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-10-08', null, null, false, null),
  ('6f3efccd-37b5-4171-8d14-88c8d5416858', 'חוג כדורגל', null, 'association', '2026-10-08T14:00:00+00:00', '2026-10-08T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-10-08', null, null, false, null),
  ('fadbe1c2-d0bb-4bd0-b619-e3a5a93a17d4', 'מצויינות אישית', null, 'association', '2026-10-09T04:00:00+00:00', '2026-10-09T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-10-09', null, null, false, null),
  ('b2fa497d-d908-483a-aea4-4bdefff2b9b6', 'חוג כדורגל', null, 'association', '2026-10-11T13:00:00+00:00', '2026-10-11T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-10-11', null, null, false, null),
  ('774601bb-7a7e-447d-989e-7bf0e8c9ac1a', 'חוג כדורגל', null, 'association', '2026-10-12T13:00:00+00:00', '2026-10-12T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-10-12', null, null, false, null),
  ('107fc21e-5e51-46bd-8b81-6e661ae66562', 'זמן קהילה', null, 'community', '2026-10-13T13:00:00+00:00', '2026-10-13T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-10-13', null, null, false, null),
  ('0a7b8d8b-4479-4d07-a3a5-4b94d77b92d7', 'מצויינות אישית', null, 'association', '2026-10-13T13:00:00+00:00', '2026-10-13T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-10-13', null, null, false, null),
  ('cd3581aa-063b-43ed-bf9e-bb65f53148a7', 'חוג כדורגל', null, 'association', '2026-10-14T13:00:00+00:00', '2026-10-14T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-10-14', null, null, false, null),
  ('dbd73ecc-eb8e-45f8-842d-90f996d07b59', 'זמן קהילה', null, 'community', '2026-10-15T14:00:00+00:00', '2026-10-15T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-10-15', null, null, false, null),
  ('b110e502-7203-4cfd-932f-956e6e272bb4', 'חוג כדורגל', null, 'association', '2026-10-15T14:00:00+00:00', '2026-10-15T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-10-15', null, null, false, null),
  ('a9c41506-c4cf-4b13-a850-a417d347fd60', 'מצויינות אישית', null, 'association', '2026-10-16T04:00:00+00:00', '2026-10-16T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-10-16', null, null, false, null),
  ('a3dad90f-54a5-449f-8635-0de2e7086027', 'חוג כדורגל', null, 'association', '2026-10-18T13:00:00+00:00', '2026-10-18T16:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-10-18', null, null, false, null),
  ('e465ab39-38a0-499a-bc4a-df5dcaf1c21f', 'חוג כדורגל', null, 'association', '2026-10-19T13:00:00+00:00', '2026-10-19T17:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-10-19', null, null, false, null),
  ('236eadbb-acaf-4c58-b87a-2587efb84ac0', 'מצויינות אישית', null, 'association', '2026-10-20T13:00:00+00:00', '2026-10-20T18:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-10-20', null, null, false, null),
  ('6de14530-aa50-4264-921c-b3b985435cba', 'זמן קהילה', null, 'community', '2026-10-20T13:00:00+00:00', '2026-10-20T18:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-10-20', null, null, false, null),
  ('1e2351e8-c6ef-4ec5-a240-151fd8b169f5', 'חוג כדורגל', null, 'association', '2026-10-21T13:00:00+00:00', '2026-10-21T16:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-10-21', null, null, false, null),
  ('ba92cab7-0e6b-4782-a923-6947ce2904b4', 'חוג כדורגל', null, 'association', '2026-10-22T14:00:00+00:00', '2026-10-22T16:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-10-22', null, null, false, null),
  ('25a22ad4-db38-4fd1-bc9c-0f341c9cc330', 'זמן קהילה', null, 'community', '2026-10-22T14:00:00+00:00', '2026-10-22T16:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-10-22', null, null, false, null),
  ('47ad0b7e-543d-451c-8c45-911c245aef8f', 'מצויינות אישית', null, 'association', '2026-10-23T04:00:00+00:00', '2026-10-23T09:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-10-23', null, null, false, null),
  ('6f828f5f-436d-4f66-ad50-549b917c134e', 'חוג כדורגל', null, 'association', '2026-10-25T14:00:00+00:00', '2026-10-25T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-10-25', null, null, false, null),
  ('c38f67e7-bde0-4603-a2e3-8c6ea6610cbe', 'חוג כדורגל', null, 'association', '2026-10-26T14:00:00+00:00', '2026-10-26T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-10-26', null, null, false, null),
  ('ef45f457-93fd-40b1-908f-dc17698c9c6c', 'מצויינות אישית', null, 'association', '2026-10-27T14:00:00+00:00', '2026-10-27T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-10-27', null, null, false, null),
  ('5112f86c-ed9c-4b76-8f1b-4172a9773e86', 'זמן קהילה', null, 'community', '2026-10-27T14:00:00+00:00', '2026-10-27T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-10-27', null, null, false, null),
  ('ff810557-610d-4b8a-a576-8b3be48b992a', 'חוג כדורגל', null, 'association', '2026-10-28T14:00:00+00:00', '2026-10-28T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-10-28', null, null, false, null),
  ('e921b145-2961-42f1-8343-418619a39643', 'זמן קהילה', null, 'community', '2026-10-29T15:00:00+00:00', '2026-10-29T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-10-29', null, null, false, null),
  ('730e2a38-bb5c-41bf-80c2-e3754315433e', 'חוג כדורגל', null, 'association', '2026-10-29T15:00:00+00:00', '2026-10-29T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-10-29', null, null, false, null),
  ('593bcd47-b4b5-4094-a77f-d36949c06ac0', 'מצויינות אישית', null, 'association', '2026-10-30T05:00:00+00:00', '2026-10-30T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-10-30', null, null, false, null),
  ('520b15db-2bc5-40ba-8545-0f956b7389ec', 'חוג כדורגל', null, 'association', '2026-11-01T14:00:00+00:00', '2026-11-01T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-11-01', null, null, false, null),
  ('1c7dccf7-cf93-414d-9a38-5b3cb9ebd6df', 'חוג כדורגל', null, 'association', '2026-11-02T14:00:00+00:00', '2026-11-02T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-11-02', null, null, false, null),
  ('c56079aa-5946-4572-afc7-050631f368b0', 'זמן קהילה', null, 'community', '2026-11-03T14:00:00+00:00', '2026-11-03T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-11-03', null, null, false, null),
  ('f35bb36a-5fc4-46a5-ad7e-9566bb3572c9', 'מצויינות אישית', null, 'association', '2026-11-03T14:00:00+00:00', '2026-11-03T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-11-03', null, null, false, null),
  ('ec205493-3ad5-41a3-b80d-52a9d79f8c17', 'חוג כדורגל', null, 'association', '2026-11-04T14:00:00+00:00', '2026-11-04T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-11-04', null, null, false, null),
  ('f297e62d-4731-44ea-a208-8fc424a8f1ac', 'חוג כדורגל', null, 'association', '2026-11-05T15:00:00+00:00', '2026-11-05T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-11-05', null, null, false, null),
  ('a5986bd7-27d9-4cf8-8228-e530f9b8e9a2', 'זמן קהילה', null, 'community', '2026-11-05T15:00:00+00:00', '2026-11-05T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-11-05', null, null, false, null),
  ('5bf67e02-455c-484a-8da0-6445ee4c925a', 'מצויינות אישית', null, 'association', '2026-11-06T05:00:00+00:00', '2026-11-06T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-11-06', null, null, false, null),
  ('a80f55bc-6d00-42a5-a617-009d252fd65e', 'חוג כדורגל', null, 'association', '2026-11-08T14:00:00+00:00', '2026-11-08T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-11-08', null, null, false, null),
  ('116bbdde-f0c9-4594-9b06-3971ca3cb172', 'חוג כדורגל', null, 'association', '2026-11-09T14:00:00+00:00', '2026-11-09T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-11-09', null, null, false, null),
  ('ce82ad2a-e9fe-4cab-bf5e-229625ca2593', 'זמן קהילה', null, 'community', '2026-11-10T14:00:00+00:00', '2026-11-10T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-11-10', null, null, false, null),
  ('37e800bc-0f9d-4190-87d0-25c816521e78', 'מצויינות אישית', null, 'association', '2026-11-10T14:00:00+00:00', '2026-11-10T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-11-10', null, null, false, null),
  ('ba4029a1-3992-48f7-9a88-782ea63184f0', 'חוג כדורגל', null, 'association', '2026-11-11T14:00:00+00:00', '2026-11-11T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-11-11', null, null, false, null),
  ('e2036e20-a730-4cc2-a284-fa44960404a2', 'חוג כדורגל', null, 'association', '2026-11-12T15:00:00+00:00', '2026-11-12T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-11-12', null, null, false, null),
  ('00b7bea0-92ba-4b37-9677-3eb634cd8050', 'זמן קהילה', null, 'community', '2026-11-12T15:00:00+00:00', '2026-11-12T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-11-12', null, null, false, null),
  ('ce9eb056-826f-4a85-9e9c-899071993381', 'מצויינות אישית', null, 'association', '2026-11-13T05:00:00+00:00', '2026-11-13T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-11-13', null, null, false, null),
  ('4761b059-942e-424c-97ab-8e8b0ea266d6', 'חוג כדורגל', null, 'association', '2026-11-15T14:00:00+00:00', '2026-11-15T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-11-15', null, null, false, null),
  ('f2443419-05c1-436e-951d-44eceaf2f151', 'חוג כדורגל', null, 'association', '2026-11-16T14:00:00+00:00', '2026-11-16T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-11-16', null, null, false, null),
  ('21486b7f-183d-4ff3-b351-e90a7eb6000d', 'מצויינות אישית', null, 'association', '2026-11-17T14:00:00+00:00', '2026-11-17T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-11-17', null, null, false, null),
  ('278d25ee-83ca-4f63-b3f0-ad32bace2fe4', 'זמן קהילה', null, 'community', '2026-11-17T14:00:00+00:00', '2026-11-17T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-11-17', null, null, false, null),
  ('9f264c89-3a12-4e96-b8d4-6e198ea66f6a', 'חוג כדורגל', null, 'association', '2026-11-18T14:00:00+00:00', '2026-11-18T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-11-18', null, null, false, null),
  ('6e72f68f-2537-4474-b9df-c86ff16c7832', 'חוג כדורגל', null, 'association', '2026-11-19T15:00:00+00:00', '2026-11-19T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-11-19', null, null, false, null),
  ('9981bf02-bf8b-493a-b2a1-be98a7e1df96', 'זמן קהילה', null, 'community', '2026-11-19T15:00:00+00:00', '2026-11-19T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-11-19', null, null, false, null),
  ('f0d0644d-38d8-472e-be38-58a61f45ce3b', 'מצויינות אישית', null, 'association', '2026-11-20T05:00:00+00:00', '2026-11-20T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-11-20', null, null, false, null),
  ('6f6c985e-5467-415f-9aa1-9b42f719edb8', 'חוג כדורגל', null, 'association', '2026-11-22T14:00:00+00:00', '2026-11-22T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-11-22', null, null, false, null),
  ('2e5e0547-4320-4f2e-9d45-198d2946b8a4', 'חוג כדורגל', null, 'association', '2026-11-23T14:00:00+00:00', '2026-11-23T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-11-23', null, null, false, null),
  ('5a3c2e9a-2d4b-4bd6-a367-31533ab1c639', 'מצויינות אישית', null, 'association', '2026-11-24T14:00:00+00:00', '2026-11-24T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-11-24', null, null, false, null),
  ('90aa2fc3-2a8c-467f-bae9-06ba91e5dae3', 'זמן קהילה', null, 'community', '2026-11-24T14:00:00+00:00', '2026-11-24T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-11-24', null, null, false, null),
  ('defab4e5-6879-4402-9931-d5ee81500fb5', 'חוג כדורגל', null, 'association', '2026-11-25T14:00:00+00:00', '2026-11-25T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-11-25', null, null, false, null),
  ('a9e6eb70-d4e0-46d2-8a16-4acdc8ae9741', 'זמן קהילה', null, 'community', '2026-11-26T15:00:00+00:00', '2026-11-26T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-11-26', null, null, false, null),
  ('e16bebe7-81d9-41ad-acb7-037077b2e0d5', 'חוג כדורגל', null, 'association', '2026-11-26T15:00:00+00:00', '2026-11-26T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-11-26', null, null, false, null),
  ('5f3930de-6092-4990-85c1-66a916a40751', 'מצויינות אישית', null, 'association', '2026-11-27T05:00:00+00:00', '2026-11-27T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-11-27', null, null, false, null),
  ('ceadbecd-76e7-4b96-b13d-0de1db03d49d', 'חוג כדורגל', null, 'association', '2026-11-29T14:00:00+00:00', '2026-11-29T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-11-29', null, null, false, null),
  ('ad435552-9927-46ca-bf83-e646f7ccb2f2', 'חוג כדורגל', null, 'association', '2026-11-30T14:00:00+00:00', '2026-11-30T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-11-30', null, null, false, null),
  ('e54b13fc-f0db-4e4a-b7a5-06d8f585ecf1', 'מצויינות אישית', null, 'association', '2026-12-01T14:00:00+00:00', '2026-12-01T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-12-01', null, null, false, null),
  ('6266b653-cb26-434d-93ed-1bea097dc2ab', 'זמן קהילה', null, 'community', '2026-12-01T14:00:00+00:00', '2026-12-01T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-12-01', null, null, false, null),
  ('ace9a5ca-6d8b-4092-917b-dc3d097a9b1b', 'חוג כדורגל', null, 'association', '2026-12-02T14:00:00+00:00', '2026-12-02T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-12-02', null, null, false, null),
  ('5f269825-b31a-40c4-b564-e278f546f75d', 'חוג כדורגל', null, 'association', '2026-12-03T15:00:00+00:00', '2026-12-03T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-12-03', null, null, false, null),
  ('637e3fc1-7386-4dc0-8d05-e8226814d5a7', 'זמן קהילה', null, 'community', '2026-12-03T15:00:00+00:00', '2026-12-03T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-12-03', null, null, false, null),
  ('20922eec-e21d-4735-9ee4-f07e2325a108', 'מצויינות אישית', null, 'association', '2026-12-04T05:00:00+00:00', '2026-12-04T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-12-04', null, null, false, null),
  ('3bd6fbf7-14bd-4ddc-936f-b0b60cc1567c', 'חוג כדורגל', null, 'association', '2026-12-06T14:00:00+00:00', '2026-12-06T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-12-06', null, null, false, null),
  ('ef244e48-8767-403f-b73a-b00f5735560d', 'חוג כדורגל', null, 'association', '2026-12-07T14:00:00+00:00', '2026-12-07T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-12-07', null, null, false, null),
  ('cca2ec72-29eb-4264-bfce-07d9253cd259', 'מצויינות אישית', null, 'association', '2026-12-08T14:00:00+00:00', '2026-12-08T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-12-08', null, null, false, null),
  ('e39764fa-b273-4f59-8720-dd521e9eaeca', 'זמן קהילה', null, 'community', '2026-12-08T14:00:00+00:00', '2026-12-08T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-12-08', null, null, false, null),
  ('df3beaa5-c905-46d5-bfc3-d3db1fafe641', 'חוג כדורגל', null, 'association', '2026-12-09T14:00:00+00:00', '2026-12-09T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-12-09', null, null, false, null),
  ('a0587709-a197-42cc-9d32-b3130c8520a7', 'חוג כדורגל', null, 'association', '2026-12-10T15:00:00+00:00', '2026-12-10T17:00:00+00:00', 'scheduled', 'recurring', null, 'dc312750-f63f-45bf-839a-ea378ffaa9ae', '2026-12-10', null, null, false, null),
  ('3bbbabad-9b32-4b30-9ecd-c17ce3f8e184', 'זמן קהילה', null, 'community', '2026-12-10T15:00:00+00:00', '2026-12-10T17:00:00+00:00', 'scheduled', 'recurring', null, '8ec0d877-77f3-4c17-983e-59c61c8c929f', '2026-12-10', null, null, false, null),
  ('ca84ebdc-2cf1-4936-829c-107e696466b7', 'מצויינות אישית', null, 'association', '2026-12-11T05:00:00+00:00', '2026-12-11T10:00:00+00:00', 'scheduled', 'recurring', null, '878c4410-e024-46f8-8f42-4177446de546', '2026-12-11', null, null, false, null),
  ('82dd0d37-e414-4526-8096-58001e6b24d2', 'חוג כדורגל', null, 'association', '2026-12-13T14:00:00+00:00', '2026-12-13T17:00:00+00:00', 'scheduled', 'recurring', null, '4cc35722-3c25-4642-84a2-eb4e32c34cd5', '2026-12-13', null, null, false, null),
  ('8d4e86d2-282b-450d-84ae-3139c23191de', 'חוג כדורגל', null, 'association', '2026-12-14T14:00:00+00:00', '2026-12-14T18:00:00+00:00', 'scheduled', 'recurring', null, '0378d820-8a64-4578-83a0-c01d79428261', '2026-12-14', null, null, false, null),
  ('b686ef98-4421-4e22-8706-013b7b225272', 'מצויינות אישית', null, 'association', '2026-12-15T14:00:00+00:00', '2026-12-15T19:00:00+00:00', 'scheduled', 'recurring', null, 'f3f7b5b4-40d0-4941-8e34-bf63f9e42fb3', '2026-12-15', null, null, false, null),
  ('bc8b05a3-a87e-434d-bbe7-08b60c599b75', 'זמן קהילה', null, 'community', '2026-12-15T14:00:00+00:00', '2026-12-15T19:00:00+00:00', 'scheduled', 'recurring', null, 'a619aec1-ac48-4cfa-bfe6-0b79d3e214e8', '2026-12-15', null, null, false, null),
  ('cb127d0d-9df6-450f-98b2-6d97ec8a79d2', 'חוג כדורגל', null, 'association', '2026-12-16T14:00:00+00:00', '2026-12-16T17:00:00+00:00', 'scheduled', 'recurring', null, 'bbf770dc-cbd2-411a-b704-ed2b7bc69eb0', '2026-12-16', null, null, false, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Closures (FR-35): the pitch blocked for maintenance or weather.
-- ---------------------------------------------------------------------------
-- (no closures rows in the snapshot)

-- ---------------------------------------------------------------------------
-- Your own admin access, for local work. Uncomment and put your address in:
-- the row grants nothing by itself, but `is_admin()` reads this table, so it
-- is what makes /admin open once you have signed in through Google.
-- ---------------------------------------------------------------------------
-- insert into admin_allowlist (email, full_name, role)
-- values ('you@example.com', 'Your Name', 'super_admin')
-- on conflict (email) do nothing;
