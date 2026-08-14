import Link from 'next/link';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { WEEKDAY_LETTERS, dayOfMonth, formatWeekdayLong, type LocalDate } from '@/lib/time';

/**
 * Day view's own day picker — the week strip from `<WeekGrid>`'s header,
 * redrawn as seven tappable stops instead of seven read-only column labels.
 * `<WeekNav>` above it still moves a whole WEEK at a time; this is what picks
 * which single day of that week the cards below belong to.
 */
export function DayStrip({
  days,
  selectedDate,
  weekStart,
}: {
  days: LocalDate[];
  selectedDate: LocalDate;
  weekStart: LocalDate;
}) {
  return (
    <div
      role="group"
      aria-label={t('schedule.day_detail')}
      className="flex justify-between gap-0.5 rounded-(--radius-card) border border-(--hairline) bg-(--surface-raised) px-1 py-2 shadow-(--shadow-sm) sm:gap-1 sm:px-2"
    >
      {days.map((date) => {
        const isSelected = date === selectedDate;
        return (
          <Link
            key={date}
            href={`/?view=day&week=${weekStart}&date=${date}`}
            aria-current={isSelected ? 'date' : undefined}
            className={cn(
              'press flex min-w-0 flex-1 flex-col items-center gap-1 rounded-(--radius-input) py-1.5',
              'transition-[background-color] duration-(--duration-press) ease-(--ease-out-quiet)',
              'hover:bg-(--surface-hover)',
            )}
          >
            <span
              className={cn(
                'text-[0.625rem] font-medium sm:text-xs',
                isSelected ? 'font-semibold text-primary-600' : 'text-(--ink-faint)',
              )}
            >
              {WEEKDAY_LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()]}
            </span>
            {/* The selected day sits in a filled disc — same treatment
                `<WeekGrid>`'s header gives "today", just keyed to selection
                here instead. Sized as a capped square rather than a fixed
                `size-8`: seven fixed discs do not fit a 320px phone once the
                accessibility font scale enlarges the rem they are built from,
                so the disc shrinks with its column instead of overflowing. */}
            <span
              className={cn(
                'tnum flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-sm sm:max-w-9',
                isSelected
                  ? 'bg-primary font-bold text-white shadow-(--shadow-xs)'
                  : 'font-medium text-(--ink)',
              )}
            >
              {dayOfMonth(date)}
            </span>
            <span className="sr-only">{formatWeekdayLong(date)}</span>
          </Link>
        );
      })}
    </div>
  );
}
