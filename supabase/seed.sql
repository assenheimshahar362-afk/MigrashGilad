-- ===========================================================================
-- Migrash Gilad — development seed (Milestone 1)
--
-- Two trustees and a week of sample events that deliberately spans Friday and
-- Saturday, so that any code path which quietly skips the weekend shows up
-- immediately in the grid (§1.4, acceptance scenario 18).
--
-- Times are written in Asia/Jerusalem local time and converted on the way in.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trustees (§4.4). Placeholder data — real names, titles, phones and photos
-- are open decision #6 and must come from the product owner before launch.
-- ---------------------------------------------------------------------------
insert into trustees (full_name, title, phone_e164, display_order, is_primary, is_available)
values
  ('יעל בר-אילן', 'נאמנת מגרש', '+972501111111', 1, true,  true),
  ('אורי כהן',    'רכז נוער',   '+972502222222', 2, false, true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- A recurring association allocation and a recurring Friday community slot.
-- Weekday 2 = Tuesday, weekday 5 = Friday, weekday 6 = Saturday.
-- ---------------------------------------------------------------------------
insert into recurring_rules (title, usage_type, weekday, start_time, end_time, valid_from, contact_name)
values
  ('אימון עמותה',        'association', 2, '17:00', '19:00', current_date, 'רכז העמותה'),
  ('משחק קהילתי — שישי', 'community',   5, '16:00', '18:00', current_date, 'נאמן המגרש'),
  ('משחק קהילתי — שבת',  'community',   6, '10:00', '12:00', current_date, 'נאמן המגרש')
on conflict do nothing;

select materialize_recurring(30);

-- ---------------------------------------------------------------------------
-- A handful of one-off events across the current week, including Friday and
-- Saturday. Each is placed relative to the start of the current local week
-- (Sunday) so the seed stays useful whenever it is run.
-- ---------------------------------------------------------------------------
do $$
declare
  week_start date := (now() at time zone 'Asia/Jerusalem')::date
                     - extract(dow from (now() at time zone 'Asia/Jerusalem')::date)::int;
  spec record;
begin
  for spec in
    select * from (values
      (0, '08:00'::time, '10:00'::time, 'כדורגל נוער',        'community'::usage_type),
      (1, '19:00',       '21:00',       'ליגת עובדי הקיבוץ',  'community'::usage_type),
      (3, '16:30',       '18:30',       'אימון עמותה',        'association'::usage_type),
      (4, '20:00',       '22:00',       'משחק ידידות',        'special_event'::usage_type),
      (5, '09:00',       '11:00',       'אימון בוקר',         'community'::usage_type),
      (6, '18:00',       '20:00',       'משחק שכונתי',        'community'::usage_type)
    ) as t(day_offset, t_start, t_end, title, usage)
  loop
    begin
      insert into events (title, usage_type, starts_at, ends_at, source, contact_name, show_contact)
      values (
        spec.title,
        spec.usage,
        ((week_start + spec.day_offset) + spec.t_start) at time zone 'Asia/Jerusalem',
        ((week_start + spec.day_offset) + spec.t_end)   at time zone 'Asia/Jerusalem',
        'manual',
        'נאמן המגרש',
        false
      );
    exception when exclusion_violation then
      -- A recurring occurrence already owns the slot; that is fine for a seed.
      null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- One maintenance closure next week, so the closure rendering has something to
-- show without an admin having to create one by hand.
-- ---------------------------------------------------------------------------
insert into closures (reason, starts_at, ends_at, all_day)
values (
  'תחזוקת דשא',
  (((now() at time zone 'Asia/Jerusalem')::date + 9) + time '08:00') at time zone 'Asia/Jerusalem',
  (((now() at time zone 'Asia/Jerusalem')::date + 9) + time '14:00') at time zone 'Asia/Jerusalem',
  false
)
on conflict do nothing;
