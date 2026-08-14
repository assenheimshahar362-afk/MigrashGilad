import Link from 'next/link';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import type { LocalDate } from '@/lib/time';

/**
 * Week and day are two renderings of the same fetched week — switching is a
 * plain navigation between two `?view=` URLs, not client state, so the choice
 * survives a refresh or a shared link the same way `week=` already does.
 *
 * `date` is the day view should land on: the day view's own selection when
 * one exists, otherwise whatever the page already resolved as "today, or the
 * week start if today isn't in this week" — the same fallback `<DayStrip>`
 * highlights.
 */
export function ViewToggle({
  view,
  week,
  date,
}: {
  view: 'week' | 'day';
  week: LocalDate;
  date: LocalDate;
}) {
  return (
    <div
      role="group"
      aria-label={t('schedule.view_toggle')}
      className="inline-flex gap-0.5 self-center rounded-(--radius-input) border border-(--hairline) bg-(--surface-raised) p-1"
    >
      <ToggleOption href={`/?week=${week}`} active={view === 'week'}>
        {t('schedule.view_week')}
      </ToggleOption>
      <ToggleOption href={`/?view=day&week=${week}&date=${date}`} active={view === 'day'}>
        {t('schedule.view_day')}
      </ToggleOption>
    </div>
  );
}

function ToggleOption({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'press tap-target flex items-center justify-center rounded-(--radius-input) px-5',
        'text-sm font-semibold transition-[background-color,color,transform]',
        'duration-(--duration-press) ease-(--ease-out-quiet)',
        active ? 'bg-primary-50 text-primary-700' : 'text-(--ink-muted) hover:bg-(--surface-hover)',
      )}
    >
      {children}
    </Link>
  );
}
