import {
  addLocalDays,
  localDate,
  localTime,
  toInstant,
  weekdayOfLocalDate,
  type LocalDate,
} from '@/lib/time';
import type { EventRow } from '@/lib/types';

/**
 * FR-33a: editing or deleting one occurrence of a repeating event, and saying
 * whether that means this week or every week from here on.
 *
 * The admin calendar lists occurrences, not series — an event that repeats
 * weekly is a row per week, and that is what the public grid draws. Until now
 * an edit reached exactly one of them, so correcting a title or moving an hour
 * on a booking that runs every Sunday for a year meant opening fifty rows.
 *
 * Everything here is pure and works on whole rows, so the rules for "which
 * occurrences does this edit reach" and "where does each one land" can be
 * tested (§ tests/unit/event-series.test.ts) without a database.
 */

/** Which occurrences an edit or a delete applies to. */
export type EventScope = 'single' | 'following';

/**
 * The occurrences that count as "this one and the ones after it".
 *
 * Two ways an event can repeat, and both are honoured:
 *
 *   - It was generated from a `recurring_rules` row (FR-34), in which case
 *     `recurring_id` says so exactly and nothing has to be guessed.
 *   - It was entered by hand, week after week, with the same title at the same
 *     hour on the same weekday. There is no link between those rows in the
 *     database, but they are plainly the same standing booking to the person
 *     who typed them, so the same shape of edit has to reach them.
 *
 * "After it" is inclusive of the anchor: an admin editing the 14th expects the
 * 14th to change too.
 */
export function followingOccurrences(anchor: EventRow, candidates: EventRow[]): EventRow[] {
  const from = new Date(anchor.starts_at).getTime();

  return candidates
    .filter((row) => {
      if (row.status !== 'scheduled') return false;
      if (new Date(row.starts_at).getTime() < from) return false;
      return row.id === anchor.id || isSameSeries(anchor, row);
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * Whether two rows are the same repeating booking.
 *
 * The hand-entered case deliberately compares the LOCAL weekday and wall-clock
 * times rather than the instants: an event at 17:00 every Sunday is the same
 * booking either side of a daylight-saving change, and its UTC offset is not
 * (§14).
 */
export function isSameSeries(anchor: EventRow, row: EventRow): boolean {
  if (anchor.recurring_id) return row.recurring_id === anchor.recurring_id;
  // A row belonging to some OTHER series is never swept up by a hand-entered
  // event's edit, even if it happens to match on title and hour — it has an
  // owner of its own, and that owner is the thing to edit.
  if (row.recurring_id) return false;

  return (
    row.title === anchor.title &&
    row.usage_type === anchor.usage_type &&
    weekdayOfLocalDate(localDate(row.starts_at)) === weekdayOfLocalDate(localDate(anchor.starts_at)) &&
    localTime(row.starts_at) === localTime(anchor.starts_at) &&
    localTime(row.ends_at) === localTime(anchor.ends_at)
  );
}

/** The wall-clock shape of an edit, as the anchor occurrence moved. */
export interface SeriesMove {
  /** How many days the anchor itself moved. A series moved from Sunday to
   *  Monday moves every following occurrence with it. */
  dayDelta: number;
  /** The new start and end times of day, applied to every occurrence. */
  startTime: string;
  endTime: string;
  /** Whether the end time lands on the day after the start (never, in this
   *  product's opening hours — kept explicit so the arithmetic says so). */
  endsNextDay: boolean;
}

/** Reads the move out of the anchor's before/after instants. */
export function seriesMove(before: EventRow, start: string, end: string): SeriesMove {
  const oldDate = localDate(before.starts_at);
  const newDate = localDate(start);
  const newEndDate = localDate(end);

  return {
    dayDelta: daysBetween(oldDate, newDate),
    startTime: localTime(start),
    endTime: localTime(end),
    endsNextDay: newEndDate !== newDate,
  };
}

/** Where one occurrence lands once `move` is applied to it. */
export function movedOccurrence(row: EventRow, move: SeriesMove): {
  date: LocalDate;
  startsAt: string;
  endsAt: string;
} {
  const date = addLocalDays(localDate(row.starts_at), move.dayDelta);
  const endDate = move.endsNextDay ? addLocalDays(date, 1) : date;

  return {
    date,
    startsAt: toInstant(date, move.startTime).toISOString(),
    endsAt: toInstant(endDate, move.endTime).toISOString(),
  };
}

/** Whole days from `a` to `b`, both local dates. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Two ranges of the same usage type may not overlap (G4, the
 * `events_no_overlap` exclusion constraint). A series edit writes one row at a
 * time, so this is what lets the route refuse the whole edit BEFORE writing
 * any of it rather than stopping half way through a year of Sundays.
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

// ---------------------------------------------------------------------------
// Planning. Everything below decides WHAT a series edit or delete will write,
// without writing any of it — so `app/api/admin/events/[id]/route.ts` is left
// doing I/O only, and the rules can be tested against a table of rows instead
// of against a database (§ tests/unit/event-series.test.ts).
// ---------------------------------------------------------------------------

/** One row's new values, and where it lands. */
export interface OccurrencePlan {
  id: string;
  patch: Partial<EventRow>;
  startsAt: string;
  endsAt: string;
}

/**
 * The write plan for "this occurrence and every later one".
 *
 * Field changes (title, type, contact…) apply as they are. A change of HOUR
 * applies as a wall clock, per occurrence, on that occurrence's own date — the
 * one thing that must never happen is every Sunday in the series being given
 * the anchor's date. A change of DAY moves the whole series by the same number
 * of days, which is how a booking moves from Sundays to Mondays.
 */
export function planSeriesUpdate(
  anchor: EventRow,
  targets: EventRow[],
  fields: Partial<EventRow>,
  move: SeriesMove | null,
): OccurrencePlan[] {
  return targets.map((row) => {
    const patch: Partial<EventRow> = { ...fields };
    // `starts_at`/`ends_at` in `fields` are the ANCHOR's new instants; every
    // row computes its own from the move instead.
    delete patch.starts_at;
    delete patch.ends_at;

    if (!move) {
      return { id: row.id, patch, startsAt: row.starts_at, endsAt: row.ends_at };
    }

    const moved = movedOccurrence(row, move);
    patch.starts_at = moved.startsAt;
    patch.ends_at = moved.endsAt;
    // The unique index on (recurring_id, occurrence_date) is what stops
    // `materialize_recurring` re-creating a moved occurrence beside the moved
    // one, so this has to travel with the timestamps.
    if (row.recurring_id) patch.occurrence_date = moved.date;

    return { id: row.id, patch, startsAt: moved.startsAt, endsAt: moved.endsAt };
  });
}

/** A range belonging to something other than this series. */
export interface Neighbour {
  id: string;
  starts_at: string;
  ends_at: string;
}

/**
 * The first planned occurrence that would land on top of an event outside the
 * series, or null when the whole plan is clear.
 *
 * G4 is enforced by an exclusion constraint in the database, but a series edit
 * writes a row at a time — without this the constraint would stop the loop
 * somewhere in the middle, leaving half a year moved and half not.
 */
export function findSeriesConflict(
  plans: OccurrencePlan[],
  neighbours: Neighbour[],
): OccurrencePlan | null {
  const own = new Set(plans.map((plan) => plan.id));

  return (
    plans.find((plan) =>
      neighbours.some(
        (other) =>
          !own.has(other.id) &&
          rangesOverlap(plan.startsAt, plan.endsAt, other.starts_at, other.ends_at),
      ),
    ) ?? null
  );
}

/**
 * Which rows a series delete cancels and which it removes outright.
 *
 * An event created from a booking request is cancelled rather than deleted, so
 * the `booking_requests.id -> events.request_id` link survives and the
 * request's own history keeps telling the truth (§5).
 */
export function planSeriesRemoval(targets: EventRow[]): { cancel: string[]; remove: string[] } {
  return {
    cancel: targets.filter((row) => row.request_id).map((row) => row.id),
    remove: targets.filter((row) => !row.request_id).map((row) => row.id),
  };
}
