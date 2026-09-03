import { describe, expect, it } from 'vitest';
import {
  assertRequestWindow,
  assertWithinOpeningHours,
  blockingEvents,
  clusterOverlappingEvents,
  communityFillRanges,
  conflictingEvents,
  eventsWithCommunityFill,
  gridHourRange,
  hoursForDate,
  isDayClosed,
  layoutDayEvents,
} from '@/lib/schedule';
import { minutesSinceMidnight, toInstant } from '@/lib/time';
import { AppError } from '@/lib/errors';
import {
  DEFAULT_OPENING_HOURS,
  SITE_SETTINGS,
  uniformOpeningHours,
  type PublicEvent,
} from '@/lib/types';

const settings = { ...SITE_SETTINGS };

function event(start: string, end: string, date = '2026-08-05'): PublicEvent {
  return {
    id: `${date}-${start}`,
    title: 'אימון',
    description: null,
    requesterNote: null,
    usageType: 'community',
    startsAt: toInstant(date, start).toISOString(),
    endsAt: toInstant(date, end).toISOString(),
    source: 'manual',
    contactName: null,
    contactPhone: null,
  };
}

describe('opening hours (§1.4 — all seven days are ordinary)', () => {
  it('expands global opening and closing times to every day', () => {
    expect(uniformOpeningHours('08:30', '22:15')).toEqual({
      '0': ['08:30', '22:15'],
      '1': ['08:30', '22:15'],
      '2': ['08:30', '22:15'],
      '3': ['08:30', '22:15'],
      '4': ['08:30', '22:15'],
      '5': ['08:30', '22:15'],
      '6': ['08:30', '22:15'],
    });
  });

  it('resolves hours for every weekday including Friday and Saturday', () => {
    expect(hoursForDate(DEFAULT_OPENING_HOURS, '2026-08-07')).toEqual(['07:00', '23:00']); // Fri
    expect(hoursForDate(DEFAULT_OPENING_HOURS, '2026-08-08')).toEqual(['07:00', '23:00']); // Sat
  });

  it('treats a day as closed only when settings say so EXPLICITLY', () => {
    expect(isDayClosed(DEFAULT_OPENING_HOURS, '2026-08-08')).toBe(false);
    expect(isDayClosed({ ...DEFAULT_OPENING_HOURS, '6': null }, '2026-08-08')).toBe(true);
  });

  it('unions the visible hour range across the week', () => {
    const hours = { ...DEFAULT_OPENING_HOURS, '5': ['08:00', '14:00'] as [string, string] };
    const week = ['2026-08-02', '2026-08-07', '2026-08-08'];
    expect(gridHourRange(hours, week)).toEqual({ startMinute: 7 * 60, endMinute: 23 * 60 });
  });

  it('falls back to a usable window when every day is closed', () => {
    const allClosed = Object.fromEntries([...Array(7).keys()].map((d) => [String(d), null]));
    expect(gridHourRange(allClosed, ['2026-08-02'])).toEqual({
      startMinute: 7 * 60,
      endMinute: 23 * 60,
    });
  });
});

describe('assertWithinOpeningHours', () => {
  it('accepts a Saturday slot inside opening hours (scenario 18)', () => {
    expect(() =>
      assertWithinOpeningHours(
        DEFAULT_OPENING_HOURS,
        toInstant('2026-08-08', '10:00'),
        toInstant('2026-08-08', '12:00'),
      ),
    ).not.toThrow();
  });

  it('rejects a slot that starts before opening', () => {
    expect(() =>
      assertWithinOpeningHours(
        DEFAULT_OPENING_HOURS,
        toInstant('2026-08-05', '05:00'),
        toInstant('2026-08-05', '07:00'),
      ),
    ).toThrowError(AppError);
  });

  it('rejects a slot on a day that is closed all day', () => {
    expect(() =>
      assertWithinOpeningHours(
        { ...DEFAULT_OPENING_HOURS, '6': null },
        toInstant('2026-08-08', '10:00'),
        toInstant('2026-08-08', '12:00'),
      ),
    ).toThrowError(AppError);
  });

  it('rejects a slot that crosses midnight rather than splitting it', () => {
    expect(() =>
      assertWithinOpeningHours(
        DEFAULT_OPENING_HOURS,
        toInstant('2026-08-05', '22:00'),
        toInstant('2026-08-06', '01:00'),
      ),
    ).toThrowError(AppError);
  });
});

describe('assertRequestWindow (FR-17, FR-18)', () => {
  const now = toInstant('2026-08-01', '12:00');

  it('accepts a request inside every bound', () => {
    expect(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-05', '17:00'),
        toInstant('2026-08-05', '19:00'),
        now,
      ),
    ).not.toThrow();
  });

  // FR-17's minimum notice is switched OFF (`minLeadHours: 0`): a resident
  // standing at the gate may ask for the next hour.
  it('accepts a request for later today, with no minimum notice', () => {
    expect(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-01', '13:00'), // one hour away
        toInstant('2026-08-01', '14:00'),
        now,
      ),
    ).not.toThrow();
  });

  it('still refuses a slot that has already started', () => {
    // "No minimum notice" is not "any time at all" — and this must not surface
    // as ERR_LEAD_TIME, whose message names a number of hours.
    const error = captureError(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-01', '10:00'),
        toInstant('2026-08-01', '11:00'),
        now,
      ),
    );
    expect(error?.code).toBe('ERR_PAST');
  });

  it('enforces the minimum lead time again if it is switched back on', () => {
    const error = captureError(() =>
      assertRequestWindow(
        { ...settings, minLeadHours: 12 },
        toInstant('2026-08-01', '18:00'), // 6 hours away, lead time is 12
        toInstant('2026-08-01', '19:00'),
        now,
      ),
    );
    expect(error?.code).toBe('ERR_LEAD_TIME');
  });

  it('rejects a request beyond the horizon', () => {
    const error = captureError(() =>
      assertRequestWindow(
        settings,
        toInstant('2027-08-05', '17:00'),
        toInstant('2027-08-05', '19:00'),
        now,
      ),
    );
    expect(error?.code).toBe('ERR_HORIZON');
  });

  it('rejects a request longer than the maximum duration', () => {
    const error = captureError(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-05', '10:00'),
        toInstant('2026-08-05', '15:00'), // 5h, max is two hours
        now,
      ),
    );
    expect(error?.code).toBe('ERR_DURATION');
  });

  // The cap is two hours of activity. Checked on both sides of the boundary,
  // since an off-by-one here is exactly the kind of thing that only shows up as
  // a resident being refused the slot they were told they could have.
  it('accepts exactly two hours and refuses a minute more', () => {
    expect(settings.maxDurationMin).toBe(120);

    expect(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-05', '17:00'),
        toInstant('2026-08-05', '19:00'),
        now,
      ),
    ).not.toThrow();

    const error = captureError(() =>
      assertRequestWindow(
        settings,
        toInstant('2026-08-05', '17:00'),
        toInstant('2026-08-05', '19:01'),
        now,
      ),
    );
    expect(error?.code).toBe('ERR_DURATION');
  });
});

describe('conflicts', () => {
  const events = [event('17:00', '19:00')];

  it('finds an overlapping event', () => {
    const conflicts = conflictingEvents(
      events,
      toInstant('2026-08-05', '18:00'),
      toInstant('2026-08-05', '20:00'),
    );
    expect(conflicts).toHaveLength(1);
  });

  it('does not treat a back-to-back slot as a conflict', () => {
    const conflicts = conflictingEvents(
      events,
      toInstant('2026-08-05', '19:00'),
      toInstant('2026-08-05', '21:00'),
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe('blockingEvents — only free community time is requestable', () => {
  const association = {
    ...event('17:00', '19:00'),
    id: 'assoc',
    usageType: 'association' as const,
  };

  /** The blue bands the grid fills open hours with: free, and requestable. */
  const freeCommunity = (start: string, end: string, id = 'free') => ({
    ...event(start, end),
    id,
    title: 'זמן קהילה',
  });

  const range = (start: string, end: string) =>
    [toInstant('2026-08-05', start), toInstant('2026-08-05', end)] as const;

  it('blocks a request overlapping an association event', () => {
    expect(blockingEvents([association], ...range('18:00', '20:00'))).toHaveLength(1);
  });

  it('blocks a request that only clips the edge of one', () => {
    expect(blockingEvents([association], ...range('16:00', '17:15'))).toHaveLength(1);
  });

  it('allows a back-to-back slot — the ranges are half-open', () => {
    expect(blockingEvents([association], ...range('19:00', '20:00'))).toHaveLength(0);
  });

  it('blocks a clash with a community event that is already booked', () => {
    const booked = event('17:00', '19:00');
    expect(blockingEvents([booked], ...range('17:00', '18:00'))).toHaveLength(1);
  });

  it('allows free community time', () => {
    expect(blockingEvents([freeCommunity('17:00', '19:00')], ...range('17:00', '18:00'))).toHaveLength(0);
  });

  it('allows the half-pitch slot: association shares it with free community time', () => {
    const sharing = freeCommunity('17:00', '19:00', 'half');
    expect(blockingEvents([association, sharing], ...range('17:30', '18:30'))).toHaveLength(0);
  });

  it('still blocks when the community event beside it is a different slot', () => {
    const elsewhere = freeCommunity('20:00', '21:00', 'later');
    expect(blockingEvents([association, elsewhere], ...range('18:00', '18:30'))).toHaveLength(1);
  });

  it('blocks when one of two association events in the range is unshared', () => {
    const shared = {
      ...event('19:00', '20:00'),
      id: 'assoc-2',
      usageType: 'association' as const,
    };
    const beside = freeCommunity('19:00', '20:00', 'beside');
    const blocking = blockingEvents([association, shared, beside], ...range('18:00', '20:00'));
    expect(blocking.map((e) => e.id)).toEqual(['assoc']);
  });
});

describe('layoutDayEvents — association and community sharing a slot', () => {
  it('gives a lone event the full width', () => {
    const layout = layoutDayEvents([event('17:00', '18:00')]);
    expect(layout).toEqual([{ event: layout[0]!.event, col: 0, cols: 1 }]);
  });

  it('splits two overlapping events into separate columns', () => {
    const a = event('17:00', '19:00');
    const b = { ...event('18:00', '20:00'), id: 'b', usageType: 'association' as const };
    const layout = layoutDayEvents([a, b]);

    expect(layout).toHaveLength(2);
    expect(layout.every((l) => l.cols === 2)).toBe(true);
    expect(new Set(layout.map((l) => l.col))).toEqual(new Set([0, 1]));
  });

  it('gives back-to-back events full width, not a shared column', () => {
    const a = event('17:00', '18:00');
    const b = { ...event('18:00', '19:00'), id: 'b' };
    const layout = layoutDayEvents([a, b]);

    expect(layout.every((l) => l.cols === 1)).toBe(true);
  });

  it('reuses a freed column for a third, later event', () => {
    const a = event('17:00', '18:00');
    const b = { ...event('17:00', '18:00'), id: 'b', usageType: 'association' as const };
    const c = { ...event('17:30', '19:00'), id: 'c' };
    const layout = layoutDayEvents([a, b, c]);
    const byId = new Map(layout.map((l) => [(l.event as { id: string }).id, l]));

    // a and b overlap fully (cols: 2); c overlaps both but a ends before c
    // does not free a's column until 18:00, so all three share one cluster.
    expect(byId.get(a.id)!.cols).toBe(3);
  });
});

describe('communityFillRanges — every genuinely empty minute is community time', () => {
  const DAY_START = 7 * 60; // 07:00
  const DAY_END = 23 * 60; // 23:00

  it('fills the whole day when there are no events at all', () => {
    expect(communityFillRanges([], DAY_START, DAY_END)).toEqual([
      { start: DAY_START, end: DAY_END },
    ]);
  });

  it('cuts a mid-day COMMUNITY event out too — it already speaks for its own slot', () => {
    const community = event('17:00', '19:00');
    expect(communityFillRanges([community], DAY_START, DAY_END)).toEqual([
      { start: DAY_START, end: 17 * 60 },
      { start: 19 * 60, end: DAY_END },
    ]);
  });

  it('cuts a mid-day association event out, leaving fill before and after it', () => {
    const association = { ...event('17:00', '19:00'), usageType: 'association' as const };
    expect(communityFillRanges([association], DAY_START, DAY_END)).toEqual([
      { start: DAY_START, end: 17 * 60 },
      { start: 19 * 60, end: DAY_END },
    ]);
  });

  it('leaves no fill when an association event spans the entire day', () => {
    const association = { ...event('07:00', '23:00'), usageType: 'association' as const };
    expect(communityFillRanges([association], DAY_START, DAY_END)).toEqual([]);
  });

  it('merges two overlapping events (any mix of usage types) into one gap', () => {
    const a = { ...event('17:00', '19:00'), usageType: 'association' as const };
    const b = { ...event('18:00', '20:00'), id: 'b' };
    expect(communityFillRanges([a, b], DAY_START, DAY_END)).toEqual([
      { start: DAY_START, end: 17 * 60 },
      { start: 20 * 60, end: DAY_END },
    ]);
  });

  it('clamps an event that runs outside the day bounds', () => {
    // A community-fill query for a NARROWER window than the event's own
    // start/end — e.g. the day's own opening hours are shorter than the
    // shared grid axis — still only reports gaps inside that window.
    const association = { ...event('06:00', '23:30'), usageType: 'association' as const };
    expect(communityFillRanges([association], DAY_START, DAY_END)).toEqual([]);
  });
});

describe('clusterOverlappingEvents — the grouping day view\'s combined card relies on', () => {
  it('gives a lone event its own single-item cluster', () => {
    const clusters = clusterOverlappingEvents([event('17:00', '18:00')]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(1);
  });

  it('groups a community and an association event sharing the exact same slot', () => {
    const a = event('16:00', '19:00');
    const b = { ...event('16:00', '19:00'), id: 'b', usageType: 'association' as const };
    const clusters = clusterOverlappingEvents([a, b]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
    // This is exactly the pair `<DayView>`'s combined card renders as one
    // merged "half field each" card instead of two stacked ones.
    expect(new Set(clusters[0]!.map((e) => e.usageType))).toEqual(
      new Set(['community', 'association']),
    );
  });

  it('keeps back-to-back, non-overlapping events in separate clusters', () => {
    const a = event('17:00', '18:00');
    const b = { ...event('18:00', '19:00'), id: 'b' };
    expect(clusterOverlappingEvents([a, b])).toHaveLength(2);
  });
});

describe('eventsWithCommunityFill — the day view and week grid must agree on this', () => {
  it('returns null for a day the pitch is closed', () => {
    const openingHours = { ...DEFAULT_OPENING_HOURS, '3': null };
    expect(eventsWithCommunityFill([], '2026-08-05', openingHours)).toBeNull();
  });

  it('fills a whole open day with community time when nothing is booked', () => {
    const result = eventsWithCommunityFill([], '2026-08-05', DEFAULT_OPENING_HOURS);
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({ usageType: 'community', description: null });
  });

  it('leaves a real booking alone and fills only the gaps around it', () => {
    const booking = event('17:00', '18:00');
    const result = eventsWithCommunityFill([booking], '2026-08-05', DEFAULT_OPENING_HOURS)!;

    expect(result).toContainEqual(booking);
    // The booking plus a fill before and a fill after its 07:00–23:00 day.
    expect(result).toHaveLength(3);
  });

  // `getSchedule` widens its query by a day on each side, so the list handed
  // to this function routinely carries neighbouring days' events. They must
  // not appear on this day, and — because `communityFillRanges` compares by
  // minutes-since-midnight — must not punch a hole in its coverage either.
  it('ignores events belonging to an adjacent day', () => {
    const neighbour = { ...event('16:00', '19:00', '2026-08-06'), id: 'neighbour' };
    const result = eventsWithCommunityFill([neighbour], '2026-08-05', DEFAULT_OPENING_HOURS)!;

    expect(result).not.toContainEqual(neighbour);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ usageType: 'community' });
  });

  it('covers the full opening hours with no gap when the day is unbooked', () => {
    const result = eventsWithCommunityFill([], '2026-08-05', DEFAULT_OPENING_HOURS)!;
    const covered = result
      .map((e) => [minutesSinceMidnight(e.startsAt), minutesSinceMidnight(e.endsAt)])
      .sort((a, b) => a[0]! - b[0]!);

    expect(covered[0]![0]).toBe(7 * 60);
    expect(covered.at(-1)![1]).toBe(23 * 60);
    // Contiguous: each range starts exactly where the previous one ended.
    for (let i = 1; i < covered.length; i += 1) {
      expect(covered[i]![0]).toBe(covered[i - 1]![1]);
    }
  });
});

function captureError(fn: () => void): AppError | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppError ? error : null;
  }
}
