import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * §14. Every Asia/Jerusalem conversion in the app lives in this file.
 *
 * The rule that matters: NEVER compute a slot by adding hours to a local
 * wall-clock string. Israel changes offset twice a year, so "18:00 + 2h" is not
 * always 20:00 in UTC terms. Always go local-date + local-time -> UTC through
 * `fromZonedTime`, which knows the offset on that specific date.
 */
export const TZ = 'Asia/Jerusalem';
export const LOCALE = 'he-IL';

/** Sunday..Saturday. All seven are operating days (§1.4) — no weekend concept. */
export const WEEKDAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
export const WEEKDAY_NAMES = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'יום שבת',
] as const;

/** A local calendar date, `yyyy-MM-dd`, in Asia/Jerusalem. */
export type LocalDate = string;
/** A local wall-clock time, `HH:mm`. */
export type LocalTime = string;

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/** The Asia/Jerusalem calendar date of an instant. */
export function localDate(instant: Date | string): LocalDate {
  return formatInTimeZone(new Date(instant), TZ, 'yyyy-MM-dd');
}

/** The Asia/Jerusalem wall-clock time of an instant, `HH:mm`. */
export function localTime(instant: Date | string): LocalTime {
  return formatInTimeZone(new Date(instant), TZ, 'HH:mm');
}

/**
 * Local date + local time -> the UTC instant. This is the only correct way to
 * build a slot boundary; `date-fns-tz` resolves the offset for that date, so it
 * survives both DST transitions.
 */
export function toInstant(date: LocalDate, time: LocalTime): Date {
  return fromZonedTime(`${date}T${padTime(time)}:00`, TZ);
}

/** Minutes since local midnight — the schedule grid's vertical coordinate. */
export function minutesSinceMidnight(instant: Date | string): number {
  const [h, m] = localTime(instant).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesFromTime(time: LocalTime): number {
  const [h, m] = padTime(time).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function timeFromMinutes(minutes: number): LocalTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function padTime(time: LocalTime): string {
  const [h = '0', m = '0'] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Local-date arithmetic
//
// Done on the date string rather than on Date objects, so that a DST shift can
// never turn "add one day" into "add 23 hours and land on the same date".
// ---------------------------------------------------------------------------

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function addLocalMonths(date: LocalDate, months: number): LocalDate {
  const [y, m] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + months, 1));
  return utc.toISOString().slice(0, 10);
}

export function weekdayOfLocalDate(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** The Sunday that starts the week containing `date`. */
export function startOfLocalWeek(date: LocalDate): LocalDate {
  return addLocalDays(date, -weekdayOfLocalDate(date));
}

/** All seven days of the week starting at `sunday`. Friday and Saturday included. */
export function localWeekDays(sunday: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addLocalDays(sunday, i));
}

/** Today's Asia/Jerusalem date, regardless of where the server is. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return localDate(now);
}

// ---------------------------------------------------------------------------
// Formatting. Month and day names come from Intl, never hand-written (§14).
// ---------------------------------------------------------------------------

const dateLongFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateShortFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
});

const weekdayLongFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'long' });

/** A local date string is midday-anchored before formatting so that the
 *  timezone conversion inside Intl can never roll it to the previous day. */
function anchor(date: LocalDate): Date {
  return toInstant(date, '12:00');
}

export const formatDateLong = (date: LocalDate) => dateLongFmt.format(anchor(date));
export const formatDateShort = (date: LocalDate) => dateShortFmt.format(anchor(date));
export const formatWeekdayLong = (date: LocalDate) => weekdayLongFmt.format(anchor(date));

export function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

/**
 * A time range, written LTR-isolated (§11.4). The direction marks are part of
 * the string so that a caller cannot forget them; the en dash is the separator
 * the spec calls for.
 */
export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${localTime(start)}–${localTime(end)}`;
}

const relativeFmt = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/** "לפני 12 דקות" (§14). */
export function formatRelative(instant: Date | string, now: Date = new Date()): string {
  let delta = (new Date(instant).getTime() - now.getTime()) / 1000;
  for (const [unit, span] of RELATIVE_STEPS) {
    if (Math.abs(delta) < span) {
      return relativeFmt.format(Math.round(delta), unit);
    }
    delta /= span;
  }
  return relativeFmt.format(Math.round(delta), 'year');
}

/** The week range shown in the header, e.g. "3 באוג׳ – 9 באוג׳". */
export function formatWeekRange(sunday: LocalDate): string {
  return `${formatDateShort(sunday)} – ${formatDateShort(addLocalDays(sunday, 6))}`;
}

// ---------------------------------------------------------------------------
// Overlap. `[)` half-open everywhere, matching the tstzrange in the database
// so the UI and the exclusion constraint agree on what "touching" means.
// ---------------------------------------------------------------------------

export function overlaps(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime()
  );
}
