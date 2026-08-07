import {
  addLocalDays,
  localDate,
  localTime,
  minutesFromTime,
  overlaps,
  toInstant,
  weekdayOfLocalDate,
  type LocalDate,
  type LocalTime,
} from '@/lib/time';
import type { OpeningHours, PublicClosure, PublicEvent, PublicSettings } from '@/lib/types';
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

  // Every day closed, or no dates: fall back to the seed window so the grid
  // still has a shape to render.
  if (start >= end) return { startMinute: 6 * 60, endMinute: 23 * 60 };
  return { startMinute: start, endMinute: end };
}

export function eventsForDate(events: PublicEvent[], date: LocalDate): PublicEvent[] {
  return events
    .filter((event) => localDate(event.startsAt) === date)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function closuresForDate(closures: PublicClosure[], date: LocalDate): PublicClosure[] {
  const dayStart = toInstant(date, '00:00');
  const dayEnd = toInstant(addLocalDays(date, 1), '00:00');
  return closures.filter((closure) => overlaps(closure.startsAt, closure.endsAt, dayStart, dayEnd));
}

/** FR-9: a closure suppresses the "request this slot" affordance. */
export function isSlotClosed(closures: PublicClosure[], start: Date, end: Date): boolean {
  return closures.some((closure) => overlaps(closure.startsAt, closure.endsAt, start, end));
}

export function conflictingEvents(events: PublicEvent[], start: Date, end: Date): PublicEvent[] {
  return events.filter((event) => overlaps(event.startsAt, event.endsAt, start, end));
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

/** FR-40: the site renders muted on a memorial day stored per-year in settings. */
export function isMemorialDay(settings: PublicSettings, date: LocalDate): boolean {
  return settings.memorialDays.includes(date);
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
