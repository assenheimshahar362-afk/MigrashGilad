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
 */
export function WeekNav({ weekStart }: { weekStart: LocalDate }) {
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const prev = addLocalDays(weekStart, -7);
  const next = addLocalDays(weekStart, 7);
  const isCurrentWeek = weekStart === startOfLocalWeek(todayLocal());

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
    router.push(dx > 0 ? `/?week=${next}` : `/?week=${prev}`);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-1 pb-3',
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <NavLink href={`/?week=${prev}`} label={t('schedule.prev_week')}>
        <ChevronRight className="size-5" aria-hidden />
      </NavLink>

      <div className="flex-1 px-1 text-center sm:text-start">
        <span className="tnum text-h3 font-bold text-(--ink)" dir="ltr">
          {formatWeekRange(weekStart)}
        </span>
      </div>

      {/* When you are already on this week the control is a filled amber chip;
          otherwise it is an outline you can see but that does not compete with
          the week you are actually looking at. */}
      <Link
        href="/"
        aria-current={isCurrentWeek ? 'page' : undefined}
        className={cn(
          'press tap-target flex items-center justify-center rounded-(--radius-input) px-4',
          'text-sm font-semibold',
          'transition-[background-color,border-color,color,transform]',
          'duration-(--duration-press) ease-(--ease-out-quiet)',
          isCurrentWeek
            ? 'bg-primary-50 text-primary-700'
            : 'border border-(--hairline) bg-(--surface-raised) text-(--ink) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
        )}
      >
        {t('schedule.today')}
      </Link>

      <DatePicker weekStart={weekStart} />

      <NavLink href={`/?week=${next}`} label={t('schedule.next_week')}>
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
        'press tap-target flex items-center justify-center rounded-(--radius-input)',
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
 */
function DatePicker({ weekStart }: { weekStart: LocalDate }) {
  const router = useRouter();

  return (
    <label
      className={cn(
        'press tap-target relative flex items-center justify-center rounded-(--radius-input)',
        'border border-(--hairline) bg-(--surface-raised) text-(--ink)',
        'transition-[background-color,border-color,transform] duration-(--duration-press)',
        'ease-(--ease-out-quiet) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
      )}
    >
      <span className="sr-only">{t('schedule.pick_date')}</span>
      <CalendarRange className="size-5" aria-hidden />
      <input
        type="date"
        defaultValue={weekStart}
        onChange={(event) => {
          const value = event.target.value;
          if (value) router.push(`/?week=${startOfLocalWeek(value)}`);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
