import {
  addLocalDays,
  localDate,
  localTime,
  minutesFromTime,
  minutesSinceMidnight,
  overlaps,
  weekdayOfLocalDate,
  type LocalDate,
  type LocalTime,
} from '@/lib/time';
import type { OpeningHours, PublicEvent, PublicSettings } from '@/lib/types';
import { AppError } from '@/lib/errors';

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
  return events
    .filter((event) => localDate(event.startsAt) === date)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function conflictingEvents(events: PublicEvent[], start: Date, end: Date): PublicEvent[] {
  return events.filter((event) => overlaps(event.startsAt, event.endsAt, start, end));
}

/**
 * Association and community time may now share a slot (the events table only
 * forbids two events of the SAME category overlapping), so the grid can no
 * longer assume one event ever fully owns its time range. This assigns each
 * event a column and a column count within its overlap cluster, the classic
 * calendar side-by-side layout: events that never overlap anything else get
 * the full width (`cols: 1`), and events sharing a slot split it evenly.
 *
 * Generic rather than hardcoded to two columns — nothing here assumes the
 * cluster size, so it keeps working if a third category is ever added.
 */
export function layoutDayEvents<T extends { startsAt: string; endsAt: string }>(
  events: T[],
): Array<{ event: T; col: number; cols: number }> {
  // Timestamps are compared as instants, never as raw strings: a real event's
  // `starts_at` comes back from Supabase as "...+00:00" while the synthesized
  // community-time filler (§ week-grid.tsx) is built with `.toISOString()`,
  // which produces "...000Z". Those two spellings of the same instant sort
  // differently as strings — "+" < "." — which used to make a filler ending
  // exactly when a real event starts look like it was still open, merging two
  // back-to-back, non-overlapping events into one cluster and splitting both
  // into half-width columns instead of stacking them full-width.
  const startMs = (event: T) => new Date(event.startsAt).getTime();
  const endMs = (event: T) => new Date(event.endsAt).getTime();

  const sorted = [...events].sort((a, b) => startMs(a) - startMs(b) || endMs(a) - endMs(b));

  const layout: Array<{ event: T; col: number; cols: number }> = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
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
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length > 0 && startMs(event) >= clusterEnd) flush();
    cluster.push(event);
    if (cluster.length === 1 || endMs(event) > clusterEnd) clusterEnd = endMs(event);
  }
  flush();

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

  const leadMs = settings.minLeadHours * 60 * 60 * 1000;
  if (start.getTime() - now.getTime() < leadMs) {
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
