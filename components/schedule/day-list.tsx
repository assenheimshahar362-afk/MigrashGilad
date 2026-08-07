import { t } from '@/lib/i18n';
import { formatTimeRange, formatWeekdayLong, type LocalDate } from '@/lib/time';
import { groupByDay } from '@/lib/schedule';
import { firstNameOnly, type PublicEvent } from '@/lib/types';
import { usageTypeLabel } from '@/lib/usage-type';

/**
 * A11Y-5: the schedule has a screen-reader alternative — a visually-hidden,
 * semantically ordered list of the week's events. Do not rely on the grid alone.
 *
 * The grid conveys time by absolute position, which a screen reader cannot
 * narrate. This list is the same data in chronological order, with real day
 * headings, and it is in the DOM immediately after the grid so the reading
 * order is grid-then-detail rather than the other way round.
 *
 * `visuallyHidden = false` reuses it as the visible day drill-down for the
 * month view (§10.2) and the offline shell.
 */
export function DayList({
  dates,
  events,
  visuallyHidden = true,
  headingId,
}: {
  dates: LocalDate[];
  events: PublicEvent[];
  visuallyHidden?: boolean;
  headingId?: string;
}) {
  const grouped = groupByDay(events, dates);

  return (
    <section className={visuallyHidden ? 'sr-only' : undefined} aria-labelledby={headingId}>
      {headingId ? (
        <h2 id={headingId} className={visuallyHidden ? undefined : 'sr-only'}>
          {t('schedule.sr_heading')}
        </h2>
      ) : (
        <h2>{t('schedule.sr_heading')}</h2>
      )}

      {grouped.map(({ date, events: dayEvents }) => (
        <div key={date} className={visuallyHidden ? undefined : 'border-b border-[--hairline] py-3 last:border-0'}>
          <h3
            className={
              visuallyHidden ? undefined : 'mb-2 text-sm font-bold text-[--ink-muted]'
            }
          >
            {dayEvents.length > 0
              ? t('schedule.sr_day_events', {
                  day: formatWeekdayLong(date),
                  count: dayEvents.length,
                })
              : t('schedule.sr_day_empty', { day: formatWeekdayLong(date) })}
          </h3>

          {dayEvents.length > 0 ? (
            <ul className={visuallyHidden ? undefined : 'space-y-1.5'}>
              {dayEvents.map((event) => (
                <li key={event.id} className={visuallyHidden ? undefined : 'flex gap-3 text-sm'}>
                  <time className="tnum shrink-0" dir="ltr">
                    {formatTimeRange(event.startsAt, event.endsAt)}
                  </time>
                  <span className="font-semibold">
                    {event.source === 'request' ? firstNameOnly(event.title) : event.title}
                  </span>
                  <span className="text-[--ink-muted]">{usageTypeLabel(event.usageType)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}
