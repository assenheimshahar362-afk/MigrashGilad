import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  localDate,
  localTime,
  localWeekDays,
  minutesSinceMidnight,
  overlaps,
  startOfLocalWeek,
  timeFromMinutes,
  toInstant,
  weekdayOfLocalDate,
} from '@/lib/time';

/**
 * §18.2 unit layer: time conversion helpers.
 *
 * The suite runs with TZ=UTC on purpose (vitest.config.ts). If any of these
 * pass only because the machine happens to be in Israel, they are worthless.
 */
describe('local date arithmetic', () => {
  it('starts the week on Sunday and includes all seven days', () => {
    // 2026-08-05 is a Wednesday.
    const week = startOfLocalWeek('2026-08-05');
    expect(week).toBe('2026-08-02');

    const days = localWeekDays(week);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-02'); // Sunday
    expect(days[5]).toBe('2026-08-07'); // Friday — an ordinary operating day
    expect(days[6]).toBe('2026-08-08'); // Saturday — likewise
  });

  it('maps weekday 5 to Friday and 6 to Saturday', () => {
    expect(weekdayOfLocalDate('2026-08-07')).toBe(5);
    expect(weekdayOfLocalDate('2026-08-08')).toBe(6);
  });

  it('adds days without drifting across a month boundary', () => {
    expect(addLocalDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addLocalDays('2026-01-01', -1)).toBe('2025-12-31');
  });

});

describe('Asia/Jerusalem conversion', () => {
  it('round-trips a local wall-clock time through UTC', () => {
    const instant = toInstant('2026-08-05', '18:00');
    expect(localDate(instant)).toBe('2026-08-05');
    expect(localTime(instant)).toBe('18:00');
  });

  /**
   * Acceptance scenario 11: crossing the DST boundary, an event created for
   * 18:00 local displays as 18:00 local before and after the change.
   *
   * Israel moves to IDT on the Friday before the last Sunday of March, and back
   * on the last Sunday of October. These two dates sit on either side of the
   * October 2026 transition.
   */
  it('keeps 18:00 local at 18:00 across the autumn DST transition', () => {
    const beforeTransition = toInstant('2026-10-20', '18:00'); // IDT, UTC+3
    const afterTransition = toInstant('2026-11-03', '18:00'); // IST, UTC+2

    expect(localTime(beforeTransition)).toBe('18:00');
    expect(localTime(afterTransition)).toBe('18:00');

    // The two instants are NOT the same time of day in UTC — which is exactly
    // why "add hours to a wall-clock string" is forbidden (§14).
    expect(beforeTransition.toISOString().slice(11, 16)).toBe('15:00');
    expect(afterTransition.toISOString().slice(11, 16)).toBe('16:00');
  });

  it('keeps 18:00 local at 18:00 across the spring DST transition', () => {
    expect(localTime(toInstant('2026-03-24', '18:00'))).toBe('18:00');
    expect(localTime(toInstant('2026-03-30', '18:00'))).toBe('18:00');
  });

  it('computes minutes since local midnight, not since UTC midnight', () => {
    // 18:00 IDT is 15:00 UTC. The grid coordinate must be 1080, not 900.
    expect(minutesSinceMidnight(toInstant('2026-08-05', '18:00'))).toBe(18 * 60);
  });
});

describe('minute helpers', () => {
  it('formats minutes back to a padded wall-clock time', () => {
    expect(timeFromMinutes(6 * 60)).toBe('06:00');
    expect(timeFromMinutes(23 * 60 + 30)).toBe('23:30');
  });
});

describe('overlap', () => {
  const a = ['2026-08-05T14:00:00Z', '2026-08-05T16:00:00Z'] as const;

  it('treats ranges as half-open, matching the tstzrange in the database', () => {
    // Touching at the boundary is NOT an overlap: [14,16) and [16,18).
    expect(overlaps(a[0], a[1], '2026-08-05T16:00:00Z', '2026-08-05T18:00:00Z')).toBe(false);
    expect(overlaps(a[0], a[1], '2026-08-05T15:59:00Z', '2026-08-05T18:00:00Z')).toBe(true);
  });

  it('detects containment in both directions', () => {
    expect(overlaps(a[0], a[1], '2026-08-05T14:30:00Z', '2026-08-05T15:00:00Z')).toBe(true);
    expect(overlaps(a[0], a[1], '2026-08-05T10:00:00Z', '2026-08-05T20:00:00Z')).toBe(true);
  });
});
