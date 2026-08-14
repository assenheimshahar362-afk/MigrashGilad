'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, CalendarRange } from 'lucide-react';
import { t } from '@/lib/i18n';
import { addLocalDays, formatWeekRange, startOfLocalWeek, todayLocal, type LocalDate } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * FR-6: previous/next week, a "today" reset, and a date picker. Navigation must
 * be swipeable on touch devices and must update the URL so a week can be
 * shared.
 *
 * §11.4: chevrons imply direction, so they mirror. In RTL the *next* week is to
 * the LEFT, which is why ChevronLeft carries the "next" label — this pairing
 * looks wrong to an LTR reader and is correct here.
 *
 * `view`/`date` are the day view's own state (§ view-toggle.tsx,
 * day-strip.tsx): omitted, every link here is a plain week move, exactly as
 * before day view existed. Passed, this still moves whole weeks — `date`
 * itself is chosen on `<DayStrip>` — but every link stays in day view and
 * `today` and the date picker land on today's/the picked date directly rather
 * than leaving the day view to guess which day of the new week to show.
 */
export function WeekNav({
  weekStart,
  view = 'week',
  date,
}: {
  weekStart: LocalDate;
  view?: 'week' | 'day';
  date?: LocalDate;
}) {
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const prev = addLocalDays(weekStart, -7);
  const next = addLocalDays(weekStart, 7);
  const today = todayLocal();
  const isToday = view === 'day' ? date === today : weekStart === startOfLocalWeek(today);

  const weekHref = (target: LocalDate) =>
    view === 'day' ? `/?view=day&week=${target}` : `/?week=${target}`;
  const todayHref =
    view === 'day' ? `/?view=day&week=${startOfLocalWeek(today)}&date=${today}` : '/';

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // A vertical scroll must never be read as a week change; the grid is taller
    // than the viewport and scrolling is the common gesture.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    // RTL: dragging the content to the right reveals what is to its left, which
    // is the next week.
    router.push(dx > 0 ? weekHref(next) : weekHref(prev));
  };

  return (
    <div
      className={cn(
        'week-nav flex flex-wrap items-center justify-center gap-1 px-1 pb-3',
        'min-[360px]:flex-nowrap sm:gap-1.5',
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <NavLink href={weekHref(prev)} label={t('schedule.prev_week')}>
        <ChevronRight className="size-5" aria-hidden />
      </NavLink>

      {/* The range sits INSIDE the centred cluster rather than on its own line
          above it: the date, the date picker and "today" read as one group
          between the two arrows. Five items only fit one line from ~360px
          up, so below that — and, via `.week-nav` in globals.css, at the
          enlarged accessibility font scales — it drops back to its own full
          width line, which is far better than an ellipsised date. `min-w-0`
          + `truncate` are the last resort so it can never push an arrow off
          the end. */}
      <div className="week-nav-range order-first w-full min-w-0 px-0.5 text-center min-[360px]:order-none min-[360px]:w-auto sm:px-1">
        <span className="tnum block truncate text-sm font-bold text-(--ink) sm:text-h3" dir="ltr">
          {formatWeekRange(weekStart)}
        </span>
      </div>

      {/* When you are already on this week the control is a filled amber chip;
          otherwise it is an outline you can see but that does not compete with
          the week you are actually looking at. */}
      <Link
        href={todayHref}
        aria-current={isToday ? 'page' : undefined}
        className={cn(
          'press tap-target flex shrink-0 items-center justify-center rounded-(--radius-input) px-3 sm:px-4',
          'text-sm font-semibold',
          'transition-[background-color,border-color,color,transform]',
          'duration-(--duration-press) ease-(--ease-out-quiet)',
          isToday
            ? 'bg-primary-50 text-primary-700'
            : 'border border-(--hairline) bg-(--surface-raised) text-(--ink) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
        )}
      >
        {t('schedule.today')}
      </Link>

      <DatePicker weekStart={weekStart} view={view} />

      <NavLink href={weekHref(next)} label={t('schedule.next_week')}>
        <ChevronLeft className="size-5" aria-hidden />
      </NavLink>
    </div>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'press tap-target flex shrink-0 items-center justify-center rounded-(--radius-input)',
        'border border-(--hairline) bg-(--surface-raised) text-(--ink)',
        'transition-[background-color,border-color,transform] duration-(--duration-press)',
        'ease-(--ease-out-quiet) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A native date input rather than a custom calendar: it is already localised,
 * already keyboard accessible, and on a phone it opens the platform picker the
 * visitor already knows.
 *
 * The input itself is not the tap target. It used to be — a `<label>` with an
 * `opacity-0` input stretched over it via `inset-0` — but a native date input
 * sitting right beside the "next week" chevron is exactly the shape of mobile
 * Safari's small-tap-target hit-slop bug: WebKit silently grows a small form
 * control's touch region into adjoining empty space, so a tap aimed at the
 * chevron next to it can land on the date input instead and pop the platform
 * picker. A real `<button>` calls `showPicker()`; the input itself is
 * `pointer-events-none` and cannot receive a stray tap at all.
 */
function DatePicker({ weekStart, view }: { weekStart: LocalDate; view: 'week' | 'day' }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.focus();
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={t('schedule.pick_date')}
        onClick={openPicker}
        className={cn(
          'press tap-target flex items-center justify-center rounded-(--radius-input)',
          'border border-(--hairline) bg-(--surface-raised) text-(--ink)',
          'transition-[background-color,border-color,transform] duration-(--duration-press)',
          'ease-(--ease-out-quiet) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
        )}
      >
        <CalendarRange className="size-5" aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="date"
        aria-hidden="true"
        tabIndex={-1}
        defaultValue={weekStart}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          // A picked date is a specific day, not just a week: in day view it
          // should land on that exact day rather than leaving the day view to
          // guess which day of the new week to show.
          router.push(
            view === 'day'
              ? `/?view=day&week=${startOfLocalWeek(value)}&date=${value}`
              : `/?week=${startOfLocalWeek(value)}`,
          );
        }}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </div>
  );
}
