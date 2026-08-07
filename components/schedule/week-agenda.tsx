import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { dayOfMonth, formatWeekdayLong, localWeekDays, todayLocal, type LocalDate } from '@/lib/time';
import { closuresForDate, eventsForDate, hoursForDate } from '@/lib/schedule';
import type { PublicClosure, PublicEvent, PublicSettings } from '@/lib/types';
import { EventRow } from '@/components/schedule/event-block';

/**
 * §10.1 on a phone.
 *
 * The seven-column time grid needs roughly 70px per column to carry a title and
 * a time range. At 360px it gets 39px, which truncates every title to a single
 * character and clips the times mid-digit — so below `sm` the same week is a day
 * agenda instead. The grid is the right form on a tablet upwards, and this is
 * the right form on a phone; neither is a degraded version of the other.
 *
 * All seven days are listed, empty ones included (FR-1): the week is a shape a
 * visitor scans, and dropping the quiet days would make it unreadable as a week.
 * An empty day inside opening hours is itself the request affordance (FR-10),
 * which is what the grid's tappable slots do on a wider screen.
 */
export function WeekAgenda({
  weekStart,
  events,
  closures,
  settings,
  className,
}: {
  weekStart: LocalDate;
  events: PublicEvent[];
  closures: PublicClosure[];
  settings: PublicSettings;
  className?: string;
}) {
  const days = localWeekDays(weekStart);
  const today = todayLocal();

  return (
    <div
      className={cn(
        'divide-y divide-(--hairline) overflow-clip rounded-(--radius-card)',
        'border border-(--hairline) bg-(--surface-raised) shadow-(--shadow-sm)',
        className,
      )}
    >
      {days.map((date) => (
        <AgendaDay
          key={date}
          date={date}
          isToday={date === today}
          events={eventsForDate(events, date)}
          closures={closuresForDate(closures, date)}
          settings={settings}
        />
      ))}
    </div>
  );
}

function AgendaDay({
  date,
  isToday,
  events,
  closures,
  settings,
}: {
  date: LocalDate;
  isToday: boolean;
  events: PublicEvent[];
  closures: PublicClosure[];
  settings: PublicSettings;
}) {
  const dayHours = hoursForDate(settings.openingHours, date);
  const allDayClosure = closures.find((closure) => closure.allDay);
  const closed = !dayHours || Boolean(allDayClosure);
  const bookable = !closed && settings.requestsOpen;

  return (
    <section className={cn('px-3 py-3', isToday && 'bg-primary-50/40')} aria-label={formatWeekdayLong(date)}>
      <h3 className="flex items-baseline gap-2 px-1 pb-2">
        {/* Today is a filled disc rather than a heavier weight, matching the
            week strip on the grid — one shape the eye finds before it reads. */}
        <span
          className={cn(
            'tnum flex size-6 shrink-0 items-center justify-center rounded-full text-sm',
            isToday ? 'bg-primary font-bold text-white' : 'font-semibold text-(--ink)',
          )}
        >
          {dayOfMonth(date)}
        </span>
        <span
          className={cn(
            'text-sm font-semibold',
            isToday ? 'text-primary-700' : 'text-(--ink-muted)',
          )}
        >
          {formatWeekdayLong(date)}
        </span>
      </h3>

      {closed ? (
        <p className="closure-hatch rounded-(--radius-card-sm) border border-danger/30 px-3 py-2.5 text-sm font-semibold text-danger-ink">
          {allDayClosure
            ? t('schedule.closed_banner', { reason: allDayClosure.reason })
            : t('schedule.closed_day')}
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventRow event={event} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* FR-10: a free day is an invitation. The dashed outline says "nothing
          here yet" without the weight of a card, and the whole row is the
          target rather than a small link at its end. */}
      {events.length === 0 && bookable ? (
        <Link
          href={`/request?date=${date}`}
          className={cn(
            'press flex min-h-12 w-full items-center justify-center gap-2 rounded-(--radius-card-sm)',
            'border border-dashed border-(--hairline-strong) text-sm font-medium text-(--ink-muted)',
            'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
            'hover:bg-primary-50 hover:text-primary-700 motion-reduce:transition-none',
          )}
        >
          <Plus className="size-4" aria-hidden />
          {t('agenda.free_day')}
        </Link>
      ) : null}

      {events.length === 0 && !bookable && !closed ? (
        <p className="px-1 text-sm text-(--ink-faint)">{t('agenda.no_events')}</p>
      ) : null}
    </section>
  );
}
