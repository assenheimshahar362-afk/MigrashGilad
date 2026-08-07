import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getSchedule, getSettings } from '@/lib/data';
import {
  addLocalMonths,
  formatMonthYear,
  localMonthGrid,
  startOfLocalMonth,
  todayLocal,
} from '@/lib/time';
import { MonthGrid } from '@/components/schedule/month-grid';
import { Legend } from '@/components/schedule/legend';
import { DayList } from '@/components/schedule/day-list';

export const metadata: Metadata = { title: t('nav.month') };
export const revalidate = 300;

/**
 * FR-2 / §10.2. The month view answers "is there anything on the 14th?" — it
 * deliberately does not try to be the week view at a smaller size. Tapping a
 * day drills into that day's week (§10.2).
 */
export default async function MonthSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthStart = startOfLocalMonth(
    params.month && /^\d{4}-\d{2}/.test(params.month) ? `${params.month.slice(0, 7)}-01` : todayLocal(),
  );

  const grid = localMonthGrid(monthStart);
  const first = grid[0]!;
  const last = grid[grid.length - 1]!;

  const [{ events, closures }, settings] = await Promise.all([
    getSchedule(first, last),
    getSettings(),
  ]);

  const prev = addLocalMonths(monthStart, -1);
  const next = addLocalMonths(monthStart, 1);

  return (
    <div className="pb-24">
      <div className="flex items-center gap-1 bg-pitch-700 px-2 py-2 text-chalk-050">
        {/* §11.4: chevrons mirror. In RTL the previous month is to the right. */}
        <Link
          href={`/schedule/month?month=${prev.slice(0, 7)}`}
          aria-label={t('schedule.prev_month')}
          className="tap-target flex items-center justify-center rounded-[--radius-input] hover:bg-chalk-050/10"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>

        <h1 className="flex-1 text-center text-h3 font-bold">{formatMonthYear(monthStart)}</h1>

        <Link
          href={`/schedule/month?month=${next.slice(0, 7)}`}
          aria-label={t('schedule.next_month')}
          className="tap-target flex items-center justify-center rounded-[--radius-input] hover:bg-chalk-050/10"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      </div>

      <div className="bg-pitch-700 pb-2">
        <Legend />
      </div>

      <div className="py-3">
        <MonthGrid monthStart={monthStart} events={events} closures={closures} />
      </div>

      <div className="px-4">
        <Link href="/" className="text-sm underline underline-offset-4">
          {t('nav.week')}
        </Link>
      </div>

      {/* A11Y-5: the same alternative list, scoped to the month. */}
      <DayList dates={grid} events={events} headingId="month-sr-list" />

      <p className="sr-only">{settings.pitchName}</p>
    </div>
  );
}
