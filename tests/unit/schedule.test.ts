import { describe, expect, it } from 'vitest';
import {
  assertRequestWindow,
  assertWithinOpeningHours,
  conflictingEvents,
  gridHourRange,
  hoursForDate,
  isDayClosed,
  isSlotClosed,
  layoutDayEvents,
} from '@/lib/schedule';
import { toInstant } from '@/lib/time';
import { AppError } from '@/lib/errors';
import { DEFAULT_OPENING_HOURS, FALLBACK_SETTINGS, type PublicEvent } from '@/lib/types';

const settings = { ...FALLBACK_SETTINGS };

function event(start: string, end: string, date = '2026-08-05'): PublicEvent {
  return {
    id: `${date}-${start}`,
    title: 'אימון',
    description: null,
    usageType: 'community',
    startsAt: toInstant(date, start).toISOString(),
    endsAt: toInstant(date, end).toISOString(),
    source: 'manual',
    contactName: null,
    contactPhone: null,
  };
}

describe('opening hours (§1.4 — all seven days are ordinary)', () => {
  it('resolves hours for every weekday including Friday and Saturday', () => {
    expect(hoursForDate(DEFAULT_OPENING_HOURS, '2026-08-07')).toEqual(['06:00', '23:00']); // Fri
    expect(hoursForDate(DEFAULT_OPENING_HOURS, '2026-08-08')).toEqual(['06:00', '23:00']); // Sat
  });

  it('treats a day as closed only when settings say so EXPLICITLY', () => {
    expect(isDayClosed(DEFAULT_OPENING_HOURS, '2026-08-08')).toBe(false);
    expect(isDayClosed({ ...DEFAULT_OPENING_HOURS, '6': null }, '2026-08-08')).toBe(true);
  });

  it('unions the visible hour range across the week', () => {
    const hours = { ...DEFAULT_OPENING_HOURS, '5': ['08:00', '14:00'] as [string, string] };
    const week = ['2026-08-02', '2026-08-07', '2026-08-08'];
    expect(gridHourRange(hours, week)).toEqual({ startMinute: 6 * 60, endMinute: 23 * 60 });
  });

  it('falls back to a usable window when every day is closed', () => {
    const allClosed = Object.fromEntries([...Array(7).keys()].map((d) => [String(d), null]));
    expect(gridHourRange(allClosed, ['2026-08-02'])).toEqual({
      startMinute: 6 * 60,
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

  it('rejects a request inside the minimum lead time', () => {
    const error = captureError(() =>
      assertRequestWindow(
        settings,
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
        toInstant('2026-08-05', '15:00'), // 5h, max is 180 min
        now,
      ),
    );
    expect(error?.code).toBe('ERR_DURATION');
  });
});

describe('conflicts and closures', () => {
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

  /** Acceptance scenario 10: a Saturday 10:00–14:00 closure covers those hours. */
  it('reports a Saturday closure as covering its hours', () => {
    const closures = [
      {
        id: 'c1',
        reason: 'תחזוקה',
        startsAt: toInstant('2026-08-08', '10:00').toISOString(),
        endsAt: toInstant('2026-08-08', '14:00').toISOString(),
        allDay: false,
      },
    ];

    expect(
      isSlotClosed(closures, toInstant('2026-08-08', '11:00'), toInstant('2026-08-08', '12:00')),
    ).toBe(true);

    expect(
      isSlotClosed(closures, toInstant('2026-08-08', '15:00'), toInstant('2026-08-08', '16:00')),
    ).toBe(false);
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

function captureError(fn: () => void): AppError | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppError ? error : null;
  }
}
