import {
  addLocalDays,
  localDate,
  localTime,
  minutesFromTime,
  minutesSinceMidnight,
  overlaps,
  timeFromMinutes,
  toInstant,
  weekdayOfLocalDate,
  type LocalDate,
  type LocalTime,
} from '@/lib/time';
import type { OpeningHours, PublicEvent, PublicSettings } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { t } from '@/lib/i18n';

/**
 * Opening hours for one local date. All seven weekdays are looked up the same
 * way (§1.4) — there is deliberately no branch on Friday or Saturday anywhere
 * in this file, and a day is closed only when settings say so explicitly.
 */
export function hoursForDate(
  openingHours: OpeningHours,
  date: LocalDate,
): [LocalTime, LocalTime] | null {
  return openingHours[String(weekdayOfLocalDate(date))] ?? null;
}

export function isDayClosed(openingHours: OpeningHours, date: LocalDate): boolean {
  return hoursForDate(openingHours, date) === null;
}

/**
 * The vertical extent of the grid: the union of every open day in the visible
 * range, so a week where one day opens earlier still shows that hour, and days
 * keep a shared axis.
 */
export function gridHourRange(
  openingHours: OpeningHours,
  dates: LocalDate[],
): { startMinute: number; endMinute: number } {
  let start = 24 * 60;
  let end = 0;

  for (const date of dates) {
    const hours = hoursForDate(openingHours, date);
    if (!hours) continue;
    start = Math.min(start, minutesFromTime(hours[0]));
    end = Math.max(end, minutesFromTime(hours[1]));
  }

  // Every day closed, or no dates: fall back to the default window so the
  // grid still has a shape to render.
  if (start >= end) return { startMinute: 7 * 60, endMinute: 23 * 60 };
  return { startMinute: start, endMinute: end };
}

export function eventsForDate(events: PublicEvent[], date: LocalDate): PublicEvent[] {
  // Each `startsAt` is parsed once up front rather than repeatedly inside the
  // sort comparator, which a sort otherwise calls O(n log n) times.
  return events
    .filter((event) => localDate(event.startsAt) === date)
    .map((event) => ({ event, start: new Date(event.startsAt).getTime() }))
    .sort((a, b) => a.start - b.start)
    .map(({ event }) => event);
}

export function conflictingEvents(events: PublicEvent[], start: Date, end: Date): PublicEvent[] {
  return events.filter((event) => overlaps(event.startsAt, event.endsAt, start, end));
}

/**
 * The pitch belongs to the association while it has it: a public request
 * (always community time — there is no usage-type picker on the form) may not
 * be made for a slot an association event covers.
 *
 * The one exception is a slot the association is already SHARING — an
 * association event with a community event alongside it, which is exactly what
 * the calendar draws as "חצי מגרש" (§ day-view.tsx `CombinedCard`). Half the
 * pitch is community time there by definition, so a request for it is a
 * request for time the community already has.
 *
 * This returns the association events that block the range, so a caller can
 * both decide (empty = allowed) and say which booking is in the way.
 */
export function blockingAssociationEvents(
  events: PublicEvent[],
  start: Date,
  end: Date,
): PublicEvent[] {
  return conflictingEvents(events, start, end).filter(
    (event) => event.usageType === 'association' && !isSharedPitchSlot(events, event),
  );
}

/**
 * Whether an association event already has community time beside it. Compared
 * against the association event's OWN range rather than against the requested
 * one: the sharing is a property of the booking, not of who is asking about it,
 * so a request touching only its last ten minutes gets the same answer as one
 * covering the whole of it.
 */
export function isSharedPitchSlot(events: PublicEvent[], association: PublicEvent): boolean {
  return events.some(
    (other) =>
      other.id !== association.id &&
      other.usageType === 'community' &&
      overlaps(other.startsAt, other.endsAt, association.startsAt, association.endsAt),
  );
}

/**
 * Association and community time may now share a slot (the events table only
 * forbids two events of the SAME category overlapping), so neither the grid
 * nor the day view can assume one event ever fully owns its time range. This
 * groups events into overlap clusters — chronological runs of events that
 * chain-overlap each other — without deciding what a cluster of more than one
 * event should look like; `layoutDayEvents` (side-by-side columns, for the
 * grid) and the day view's combined card are two different answers to that
 * built on top of the same grouping.
 */
export function clusterOverlappingEvents<T extends { startsAt: string; endsAt: string }>(
  events: T[],
): T[][] {
  // Timestamps are compared as instants, never as raw strings: a real event's
  // `starts_at` comes back from Supabase as "...+00:00" while the synthesized
  // community-time filler (§ eventsWithCommunityFill) is built with
  // `.toISOString()`, which produces "...000Z". Those two spellings of the
  // same instant sort differently as strings — "+" < "." — which used to make
  // a filler ending exactly when a real event starts look like it was still
  // open, merging two back-to-back, non-overlapping events into one cluster.
  //
  // Parsed once per event and cached, not re-parsed on every comparison —
  // `startMs`/`endMs` are each read a few times per event below (sort,
  // clustering) as this runs on every render of the week grid.
  const cache = new Map<T, { start: number; end: number }>();
  const parsed = (event: T) => {
    let value = cache.get(event);
    if (!value) {
      value = { start: new Date(event.startsAt).getTime(), end: new Date(event.endsAt).getTime() };
      cache.set(event, value);
    }
    return value;
  };
  const startMs = (event: T) => parsed(event).start;
  const endMs = (event: T) => parsed(event).end;

  const sorted = [...events].sort((a, b) => startMs(a) - startMs(b) || endMs(a) - endMs(b));

  const clusters: T[][] = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length > 0) clusters.push(cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length > 0 && startMs(event) >= clusterEnd) flush();
    cluster.push(event);
    if (cluster.length === 1 || endMs(event) > clusterEnd) clusterEnd = endMs(event);
  }
  flush();

  return clusters;
}

/**
 * The classic calendar side-by-side layout, built on `clusterOverlappingEvents`:
 * events that never overlap anything else get the full width (`cols: 1`), and
 * events sharing a slot split it evenly. Generic rather than hardcoded to two
 * columns — nothing here assumes the cluster size, so it keeps working if a
 * third category is ever added.
 */
export function layoutDayEvents<T extends { startsAt: string; endsAt: string }>(
  events: T[],
): Array<{ event: T; col: number; cols: number }> {
  const startMs = (event: T) => new Date(event.startsAt).getTime();
  const endMs = (event: T) => new Date(event.endsAt).getTime();

  const layout: Array<{ event: T; col: number; cols: number }> = [];
  for (const cluster of clusterOverlappingEvents(events)) {
    // Greedy column assignment: each event takes the first column whose
    // previous occupant has already ended by the time it starts.
    const columnEnds: number[] = [];
    const placed: Array<{ event: T; col: number }> = [];
    for (const event of cluster) {
      const col = columnEnds.findIndex((end) => end <= startMs(event));
      if (col === -1) {
        columnEnds.push(endMs(event));
        placed.push({ event, col: columnEnds.length - 1 });
      } else {
        columnEnds[col] = endMs(event);
        placed.push({ event, col });
      }
    }
    const cols = columnEnds.length;
    for (const p of placed) layout.push({ ...p, cols });
  }
  return layout;
}

/**
 * Community time is the default, not something that has to be booked to
 * exist: any minute of a day's opening hours with no event on it AT ALL —
 * of either usage type — is community time by definition. This returns
 * that complement, the gaps genuinely empty enough to synthesize a
 * "community time" card for (§ week-grid.tsx), so the grid never simply
 * reads as blank during open hours. An explicit event, community or
 * association, already speaks for its own slot and is left alone.
 */
export function communityFillRanges(
  events: PublicEvent[],
  dayStart: number,
  dayEnd: number,
): Array<{ start: number; end: number }> {
  const busyRanges = events
    .map((event) => ({
      start: Math.max(minutesSinceMidnight(event.startsAt), dayStart),
      end: Math.min(minutesSinceMidnight(event.endsAt), dayEnd),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = dayStart;
  for (const range of busyRanges) {
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps;
}

/**
 * One local date's events, with every genuinely empty stretch of its opening
 * hours synthesized into a "community time" filler event — so a day never
 * simply reads as blank during open hours. Shared by the week grid and the
 * day view, which each render this list differently but must agree on what
 * it contains. `null` when the day is closed (§FR-37a) — there is nothing to
 * fill and no opening hours to fill it against.
 *
 * The filler is placed BEFORE the real events, only for a stable sort; by
 * construction it never overlaps one, so `clusterOverlappingEvents` always
 * gives it its own cluster.
 */
export function eventsWithCommunityFill(
  events: PublicEvent[],
  date: LocalDate,
  openingHours: OpeningHours,
): PublicEvent[] | null {
  const dayHours = hoursForDate(openingHours, date);
  if (!dayHours) return null;

  // Narrowed to `date` FIRST, and deliberately so: `getSchedule` widens its
  // query by a day on each side (§ lib/data.ts) so an event straddling
  // midnight is not lost, which means the list handed in here routinely
  // carries events belonging to the neighbouring days. `communityFillRanges`
  // compares by minutes-since-midnight and cannot tell them apart, so an
  // unfiltered list would let yesterday's 16:00–19:00 booking both appear as
  // a phantom card on today and punch a matching hole in today's community
  // coverage.
  const dayEvents = eventsForDate(events, date);

  const fill = communityFillRanges(dayEvents, minutesFromTime(dayHours[0]), minutesFromTime(dayHours[1])).map(
    (range): PublicEvent => ({
      id: `community-fill-${date}-${range.start}`,
      title: t('usage.community'),
      description: null,
      usageType: 'community',
      startsAt: toInstant(date, timeFromMinutes(range.start)).toISOString(),
      endsAt: toInstant(date, timeFromMinutes(range.end)).toISOString(),
      source: 'manual',
      contactName: null,
      contactPhone: null,
    }),
  );

  return [...fill, ...dayEvents];
}

/**
 * FR-17, FR-18: lead time, horizon and duration, all configurable. Validated
 * here so the client-side form and the route handler give identical answers —
 * the form is a courtesy, the route handler is the rule.
 */
export function assertRequestWindow(
  settings: PublicSettings,
  start: Date,
  end: Date,
  now: Date = new Date(),
): void {
  const durationMin = (end.getTime() - start.getTime()) / 60_000;

  if (durationMin <= 0) throw new AppError('ERR_VALIDATION');

  if (durationMin > settings.maxDurationMin) {
    throw new AppError('ERR_DURATION', { minutes: settings.maxDurationMin });
  }

  // A slot that has already begun is refused whatever the lead time is. This is
  // its own check rather than the `leadMs` one below with a zero threshold,
  // because ERR_LEAD_TIME's message names a number of hours — at
  // `minLeadHours: 0` that would read "יש להגיש בקשה לפחות 0 שעות מראש", which
  // states a rule that no longer exists.
  if (start.getTime() < now.getTime()) throw new AppError('ERR_PAST');

  // FR-17's minimum notice, skipped entirely when it is switched off. Keeping
  // the branch means re-enabling it is a settings change, not a code change.
  const leadMs = settings.minLeadHours * 60 * 60 * 1000;
  if (leadMs > 0 && start.getTime() - now.getTime() < leadMs) {
    throw new AppError('ERR_LEAD_TIME', { hours: settings.minLeadHours });
  }

  const horizonDate = addLocalDays(localDate(now), settings.maxHorizonDays);
  if (localDate(start) > horizonDate) {
    throw new AppError('ERR_HORIZON', { days: settings.maxHorizonDays });
  }

  assertWithinOpeningHours(settings.openingHours, start, end);
}

/**
 * A slot must sit inside one local day's opening hours. A request that crosses
 * midnight is rejected rather than split: the pitch closes at night, and a
 * request spanning two days would need two rows to model honestly.
 */
export function assertWithinOpeningHours(openingHours: OpeningHours, start: Date, end: Date): void {
  const date = localDate(start);
  const hours = hoursForDate(openingHours, date);
  if (!hours) throw new AppError('ERR_OUTSIDE_HOURS');

  const startMinutes = minutesFromTime(localTime(start));
  const endMinutes =
    localDate(end) === date ? minutesFromTime(localTime(end)) : 24 * 60;

  if (localDate(end) !== date && localTime(end) !== '00:00') {
    throw new AppError('ERR_OUTSIDE_HOURS');
  }

  if (startMinutes < minutesFromTime(hours[0]) || endMinutes > minutesFromTime(hours[1])) {
    throw new AppError('ERR_OUTSIDE_HOURS');
  }
}

/**
 * The screen-reader alternative to the grid (A11Y-5) and the offline day list
 * both need the week grouped by day, including days with nothing in them.
 */
export function groupByDay(
  events: PublicEvent[],
  dates: LocalDate[],
): Array<{ date: LocalDate; events: PublicEvent[] }> {
  return dates.map((date) => ({ date, events: eventsForDate(events, date) }));
}
