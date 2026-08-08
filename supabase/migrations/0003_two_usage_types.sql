-- ===========================================================================
-- Migrash Gilad — shrink `usage_type` to exactly two categories.
--
-- The product now recognises only "association time" (עמותה) and "community
-- time" (קהילה). `special_event`, `maintenance` and the unused `closed`
-- member are dropped from the enum entirely — closures already model
-- "nothing may be booked" as their own table and never used `usage_type`.
--
-- The two remaining categories may occupy the SAME time slot at once (an
-- association group and a community group sharing the pitch), so the
-- exclusion constraint that used to forbid ANY overlap is narrowed to forbid
-- overlap only WITHIN the same category — two association bookings still
-- cannot double-book a slot, and likewise for community, but one of each can
-- coexist.
--
-- Re-runnable like 0001: enum swap only runs once (guarded by column type
-- check), the constraint drop/recreate is idempotent.
-- ===========================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'events' and column_name = 'usage_type' and udt_name = 'usage_type'
  ) and (
    select array_agg(enumlabel order by enumlabel)
    from pg_enum
    where enumtypid = 'usage_type'::regtype
  ) <> array['association', 'community'] then

    -- Existing rows using a category that no longer exists are deleted
    -- outright, per product decision — they are not remapped into either
    -- surviving category.
    delete from events         where usage_type in ('special_event', 'maintenance', 'closed');
    delete from booking_requests where usage_type in ('special_event', 'maintenance', 'closed');
    delete from recurring_rules  where usage_type in ('special_event', 'maintenance', 'closed');

    create type usage_type_new as enum ('community', 'association');

    alter table events           alter column usage_type type usage_type_new using usage_type::text::usage_type_new;
    alter table booking_requests alter column usage_type type usage_type_new using usage_type::text::usage_type_new;
    alter table recurring_rules  alter column usage_type type usage_type_new using usage_type::text::usage_type_new;

    drop type usage_type;
    alter type usage_type_new rename to usage_type;
  end if;
end $$;

-- Narrow the overlap guarantee (G4) from "no two live events overlap" to "no
-- two live events of the SAME category overlap" — association and community
-- may now share a slot.
alter table events drop constraint if exists events_no_overlap;

do $$ begin
  alter table events add constraint events_no_overlap
    exclude using gist (
      usage_type with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status = 'scheduled');
exception when duplicate_object then null; end $$;
