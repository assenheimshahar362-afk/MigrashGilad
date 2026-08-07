import Link from 'next/link';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import {
  WEEKDAY_LETTERS,
  dayOfMonth,
  formatWeekdayLong,
  isSameLocalMonth,
  localMonthGrid,
  todayLocal,
  type LocalDate,
} from '@/lib/time';
import { closuresForDate, eventsForDate } from '@/lib/schedule';
import type { PublicClosure, PublicEvent } from '@/lib/types';
import { usageTypeStyle } from '@/lib/usage-type';

/**
 * FR-2 / §10.2: a month grid with per-day density chips rather than full event
 * blocks. Each day shows up to three coloured density bars and a count.
 *
 * Sunday-first, which under `dir="rtl"` puts Sunday in the rightmost column,
 * matching the week view. All seven columns are identical — the last two are
 * not styled as a weekend (§1.4).
 */
const MAX_BARS = 3;

export function MonthGrid({
  monthStart,
  events,
  closures,
}: {
  monthStart: LocalDate;
  events: PublicEvent[];
  closures: PublicClosure[];
}) {
  const days = localMonthGrid(monthStart);
  const today = todayLocal();

  return (
    <div>
      <div className="grid grid-cols-7 pb-2" aria-hidden>
        {WEEKDAY_LETTERS.map((letter) => (
          <div key={letter} className="py-1 text-center text-xs font-semibold text-(--ink-muted)">
            {letter}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-(--radius-card) border border-(--hairline) bg-(--hairline) shadow-(--shadow-sm)">
        {days.map((date) => (
          <DayCell
            key={date}
            date={date}
            inMonth={isSameLocalMonth(date, monthStart)}
            isToday={date === today}
            events={eventsForDate(events, date)}
            closures={closuresForDate(closures, date)}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  events,
  closures,
}: {
  date: LocalDate;
  inMonth: boolean;
  isToday: boolean;
  events: PublicEvent[];
  closures: PublicClosure[];
}) {
  const bars = events.slice(0, MAX_BARS);
  const overflow = events.length - bars.length;
  const closed = closures.length > 0;

  const label = [
    formatWeekdayLong(date),
    events.length > 0
      ? t('schedule.sr_day_events', { day: '', count: events.length }).trim()
      : t('schedule.sr_day_empty', { day: '' }).trim(),
    closed ? t('schedule.closed_banner', { reason: closures[0]?.reason ?? '' }) : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`/?week=${date}#day-${date}`}
      aria-label={label}
      className={cn(
        'press-sm flex min-h-[5.5rem] flex-col gap-1 p-2',
        'bg-(--surface-raised)',
        'transition-[background-color,transform] duration-(--duration-tip) ease-(--ease-out-quiet)',
        'hover:bg-primary-50 motion-reduce:transition-none',
        // A day outside the month recedes by SURFACE, not by opacity. Fading the
        // whole cell to 45% dragged its date down to 2.18:1 — the day numbers
        // are the one thing on this screen that must stay readable, even on the
        // days you are not looking at (A11Y-2).
        !inMonth && 'bg-(--surface-sunken)',
        isToday && 'ring-2 ring-inset ring-primary',
        closed && 'closure-hatch',
      )}
    >
      <span
        className={cn(
          'tnum flex size-6 items-center justify-center rounded-full text-sm',
          isToday
            ? 'bg-primary font-bold text-white'
            : inMonth
              ? 'font-medium text-(--ink)'
              : 'text-(--ink-faint)',
        )}
      >
        {dayOfMonth(date)}
      </span>

      <span className="mt-auto flex flex-col gap-0.5">
        {bars.map((event) => {
          const style = usageTypeStyle(event.usageType);
          return (
            <span
              key={event.id}
              aria-hidden
              className={cn(
                'block h-1.5 rounded-full',
                style.bar,
                style.patternClass,
                !inMonth && 'opacity-50',
              )}
            />
          );
        })}
        {overflow > 0 ? (
          <span className="tnum text-[0.65rem] text-(--ink-muted)" aria-hidden>
            {t('schedule.more_count', { count: overflow })}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
