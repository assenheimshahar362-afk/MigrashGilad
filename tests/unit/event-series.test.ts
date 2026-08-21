import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  findSeriesConflict,
  followingOccurrences,
  isSameSeries,
  movedOccurrence,
  planSeriesRemoval,
  planSeriesUpdate,
  rangesOverlap,
  seriesMove,
} from '@/lib/event-series';
import { toInstant } from '@/lib/time';
import type { EventRow } from '@/lib/types';

function row(overrides: Partial<EventRow> & { date: string }): EventRow {
  const { date, ...rest } = overrides;
  return {
    id: `${date}-${rest.title ?? 'אימון'}`,
    title: 'אימון',
    description: null,
    requester_note: null,
    show_note: false,
    usage_type: 'association',
    starts_at: toInstant(date, '17:00').toISOString(),
    ends_at: toInstant(date, '19:00').toISOString(),
    status: 'scheduled',
    source: 'recurring',
    request_id: null,
    recurring_id: null,
    occurrence_date: date,
    contact_name: null,
    contact_phone: null,
    show_contact: false,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...rest,
  };
}

// Four Sundays, 17:00–19:00, generated from one rule.
const RULE = 'rule-1';
const series = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23'].map((date) =>
  row({ date, recurring_id: RULE, id: `s-${date}` }),
);

describe('isSameSeries', () => {
  it('matches by rule id when the anchor came from a recurring rule', () => {
    expect(isSameSeries(series[1]!, series[3]!)).toBe(true);
    expect(isSameSeries(series[1]!, row({ date: '2026-08-30', recurring_id: 'other-rule' }))).toBe(false);
  });

  it('matches a hand-entered event by title, type, weekday and wall clock', () => {
    const anchor = row({ date: '2026-08-02', source: 'manual' });
    expect(isSameSeries(anchor, row({ date: '2026-08-09', source: 'manual' }))).toBe(true);
    // Same weekday and hour, different booking.
    expect(isSameSeries(anchor, row({ date: '2026-08-09', title: 'חוג אחר' }))).toBe(false);
    // Same title, a different hour.
    expect(
      isSameSeries(
        anchor,
        row({ date: '2026-08-09', starts_at: toInstant('2026-08-09', '18:00').toISOString() }),
      ),
    ).toBe(false);
    // Same title and hour, a different weekday.
    expect(isSameSeries(anchor, row({ date: '2026-08-10', source: 'manual' }))).toBe(false);
    // Same title and hour, but it belongs to a series of its own.
    expect(isSameSeries(anchor, row({ date: '2026-08-09', recurring_id: RULE }))).toBe(false);
  });

  it('survives a daylight-saving change, because it compares wall clocks', () => {
    // Israel leaves DST on 2026-10-25; both of these are 17:00 locally and
    // their UTC offsets differ.
    const before = row({ date: '2026-10-18', source: 'manual' });
    const after = row({ date: '2026-11-01', source: 'manual' });
    expect(before.starts_at.slice(11, 13)).not.toBe(after.starts_at.slice(11, 13));
    expect(isSameSeries(before, after)).toBe(true);
  });
});

describe('followingOccurrences', () => {
  it('takes the anchor and everything after it, never what came before', () => {
    const found = followingOccurrences(series[1]!, series);
    expect(found.map((r) => r.occurrence_date)).toEqual(['2026-08-09', '2026-08-16', '2026-08-23']);
  });

  it('leaves cancelled occurrences alone', () => {
    const withCancelled = [...series, row({ date: '2026-08-30', recurring_id: RULE, status: 'cancelled' })];
    const found = followingOccurrences(series[0]!, withCancelled);
    expect(found).toHaveLength(4);
  });

  it('returns just the anchor when nothing else matches', () => {
    const lonely = row({ date: '2026-08-02', source: 'manual' });
    expect(followingOccurrences(lonely, [lonely, row({ date: '2026-08-09', title: 'אחר' })])).toHaveLength(1);
  });
});

describe('seriesMove / movedOccurrence', () => {
  it('applies a new hour to every occurrence on its own date', () => {
    const move = seriesMove(
      series[0]!,
      toInstant('2026-08-02', '18:30').toISOString(),
      toInstant('2026-08-02', '20:00').toISOString(),
    );
    expect(move.dayDelta).toBe(0);

    const moved = movedOccurrence(series[2]!, move);
    expect(moved.date).toBe('2026-08-16');
    expect(moved.startsAt).toBe(toInstant('2026-08-16', '18:30').toISOString());
    expect(moved.endsAt).toBe(toInstant('2026-08-16', '20:00').toISOString());
  });

  it('moves the whole series when the anchor changes weekday', () => {
    const move = seriesMove(
      series[0]!,
      toInstant('2026-08-03', '17:00').toISOString(),
      toInstant('2026-08-03', '19:00').toISOString(),
    );
    expect(move.dayDelta).toBe(1);
    expect(movedOccurrence(series[3]!, move).date).toBe('2026-08-24');
  });

  it('keeps the wall clock across a daylight-saving boundary', () => {
    const octoberSunday = row({ date: '2026-10-18', recurring_id: RULE });
    const novemberSunday = row({ date: '2026-11-01', recurring_id: RULE });
    const move = seriesMove(
      octoberSunday,
      toInstant('2026-10-18', '18:00').toISOString(),
      toInstant('2026-10-18', '20:00').toISOString(),
    );
    // 18:00 local on both sides of the change, not "the same UTC hour".
    expect(movedOccurrence(novemberSunday, move).startsAt).toBe(
      toInstant('2026-11-01', '18:00').toISOString(),
    );
  });
});

describe('daysBetween', () => {
  it('counts whole local days, including across a DST change', () => {
    expect(daysBetween('2026-08-02', '2026-08-09')).toBe(7);
    expect(daysBetween('2026-08-09', '2026-08-02')).toBe(-7);
    expect(daysBetween('2026-10-18', '2026-11-01')).toBe(14);
    expect(daysBetween('2026-08-02', '2026-08-02')).toBe(0);
  });
});

describe('rangesOverlap', () => {
  const a = ['2026-08-02T14:00:00.000Z', '2026-08-02T16:00:00.000Z'] as const;

  it('is true when they intersect and false when they only touch', () => {
    expect(rangesOverlap(a[0], a[1], '2026-08-02T15:00:00.000Z', '2026-08-02T17:00:00.000Z')).toBe(true);
    expect(rangesOverlap(a[0], a[1], '2026-08-02T16:00:00.000Z', '2026-08-02T17:00:00.000Z')).toBe(false);
    expect(rangesOverlap(a[0], a[1], '2026-08-02T12:00:00.000Z', '2026-08-02T14:00:00.000Z')).toBe(false);
  });
});

describe('planSeriesUpdate', () => {
  it('carries a field change to every occurrence and leaves the hours alone', () => {
    const plans = planSeriesUpdate(series[0]!, series, { title: 'חוג חדש' }, null);
    expect(plans).toHaveLength(4);
    expect(plans.every((p) => p.patch.title === 'חוג חדש')).toBe(true);
    expect(plans.every((p) => p.patch.starts_at === undefined)).toBe(true);
    expect(plans[2]!.startsAt).toBe(series[2]!.starts_at);
  });

  it('never writes the anchor’s own instants onto the other occurrences', () => {
    const move = seriesMove(
      series[0]!,
      toInstant('2026-08-02', '18:00').toISOString(),
      toInstant('2026-08-02', '20:00').toISOString(),
    );
    const plans = planSeriesUpdate(
      series[0]!,
      series,
      { starts_at: toInstant('2026-08-02', '18:00').toISOString() },
      move,
    );
    // Each keeps its own week, at the new hour.
    expect(plans.map((p) => p.startsAt)).toEqual([
      toInstant('2026-08-02', '18:00').toISOString(),
      toInstant('2026-08-09', '18:00').toISOString(),
      toInstant('2026-08-16', '18:00').toISOString(),
      toInstant('2026-08-23', '18:00').toISOString(),
    ]);
    expect(plans.map((p) => p.patch.occurrence_date)).toEqual([
      '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23',
    ]);
  });

  it('keeps occurrence_date in step when the series changes weekday', () => {
    const move = seriesMove(
      series[0]!,
      toInstant('2026-08-03', '17:00').toISOString(),
      toInstant('2026-08-03', '19:00').toISOString(),
    );
    const plans = planSeriesUpdate(series[0]!, series, {}, move);
    expect(plans.map((p) => p.patch.occurrence_date)).toEqual([
      '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24',
    ]);
  });

  it('leaves occurrence_date off a hand-entered event, which has none', () => {
    const manual = [
      row({ date: '2026-08-02', source: 'manual', occurrence_date: null, id: 'm1' }),
      row({ date: '2026-08-09', source: 'manual', occurrence_date: null, id: 'm2' }),
    ];
    const move = seriesMove(
      manual[0]!,
      toInstant('2026-08-02', '18:00').toISOString(),
      toInstant('2026-08-02', '19:30').toISOString(),
    );
    const plans = planSeriesUpdate(manual[0]!, manual, {}, move);
    expect(plans.every((p) => p.patch.occurrence_date === undefined)).toBe(true);
    expect(plans[1]!.endsAt).toBe(toInstant('2026-08-09', '19:30').toISOString());
  });
});

describe('findSeriesConflict', () => {
  const plans = planSeriesUpdate(
    series[0]!,
    series,
    {},
    seriesMove(
      series[0]!,
      toInstant('2026-08-02', '18:00').toISOString(),
      toInstant('2026-08-02', '20:00').toISOString(),
    ),
  );

  it('finds an outsider sitting in one of the new slots', () => {
    const clash = findSeriesConflict(plans, [
      {
        id: 'other',
        starts_at: toInstant('2026-08-16', '19:00').toISOString(),
        ends_at: toInstant('2026-08-16', '21:00').toISOString(),
      },
    ]);
    expect(clash?.id).toBe('s-2026-08-16');
  });

  it('ignores the series’ own rows and anything that merely touches', () => {
    expect(
      findSeriesConflict(plans, [
        { id: 's-2026-08-09', starts_at: series[1]!.starts_at, ends_at: series[1]!.ends_at },
        {
          id: 'touching',
          starts_at: toInstant('2026-08-09', '20:00').toISOString(),
          ends_at: toInstant('2026-08-09', '21:00').toISOString(),
        },
      ]),
    ).toBeNull();
  });
});

describe('planSeriesRemoval', () => {
  it('cancels what a booking request owns and deletes the rest', () => {
    const targets = [
      series[0]!,
      row({ date: '2026-08-09', recurring_id: RULE, id: 'from-request', request_id: 'req-1' }),
    ];
    expect(planSeriesRemoval(targets)).toEqual({
      cancel: ['from-request'],
      remove: ['s-2026-08-02'],
    });
  });
});
