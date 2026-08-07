import Link from 'next/link';
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getSchedule, getSettings } from '@/lib/data';
import {
  addLocalDays,
  formatWeekRange,
  localWeekDays,
  startOfLocalWeek,
  todayLocal,
  type LocalDate,
} from '@/lib/time';
import { closuresForDate } from '@/lib/schedule';
import { WeekGrid } from '@/components/schedule/week-grid';
import { WeekNav } from '@/components/schedule/week-nav';
import { DayList } from '@/components/schedule/day-list';
import { Legend } from '@/components/schedule/legend';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: t('schedule.title'),
};

/**
 * FR-7: the schedule is readable with no login and no JavaScript-blocking auth
 * check. It is server-rendered and cached (NFR-3), and the only client
 * JavaScript on this route is the now-marker, the legend toggle, the swipe
 * handler and the event sheet — none of which the content depends on.
 *
 * G1: this is the landing screen. A visitor should know who has the pitch this
 * week in under five seconds, without tapping anything.
 */
export const revalidate = 300;

export default async function WeeklySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;

  // FR-6: the week lives in the URL so it can be shared. An unparseable value
  // falls back to this week rather than erroring — a bad link should still show
  // the visitor something useful.
  const requested = parseWeek(params.week);
  const weekStart = startOfLocalWeek(requested ?? todayLocal());
  const weekEnd = addLocalDays(weekStart, 6);

  const [{ events, closures }, settings] = await Promise.all([
    getSchedule(weekStart, weekEnd),
    getSettings(),
  ]);

  const days = localWeekDays(weekStart);
  const isEmpty = events.length === 0;

  // FR-9: a closure covering any of the visible days gets a banner as well as
  // the hatch on the grid, because the hatch alone is easy to miss on a phone.
  const activeClosures = days.flatMap((date) => closuresForDate(closures, date));
  const bannerClosure = activeClosures[0];

  return (
    <div className="pb-24">
      <h1 className="sr-only">
        {t('schedule.title')} — {t('schedule.week_of', { range: formatWeekRange(weekStart) })}
      </h1>

      <OfflineBanner />

      <WeekNav weekStart={weekStart} />

      {bannerClosure ? (
        <p
          role="status"
          className="closure-hatch border-y border-signal-err/50 bg-signal-err/10 px-4 py-2 text-sm font-semibold"
        >
          {t('schedule.closed_banner', { reason: bannerClosure.reason })}
        </p>
      ) : null}

      <WeekGrid
        weekStart={weekStart}
        events={events}
        closures={closures}
        settings={settings}
      />

      <Legend className="bg-pitch-700 pb-1 pt-1" />

      {isEmpty ? (
        <p className="px-4 py-6 text-center text-[--ink-muted]">{t('schedule.empty')}</p>
      ) : null}

      {/* A11Y-5: the screen-reader alternative to the grid. */}
      <DayList dates={days} events={events} headingId="week-sr-list" />

      <div className="px-4 pt-4">
        <Link href="/schedule/month" className="text-sm underline underline-offset-4">
          {t('nav.month')}
        </Link>
      </div>

      <ScheduleCta
        requestsOpen={settings.requestsOpen}
        closedMessage={settings.requestsClosedMsg}
      />
    </div>
  );
}

/**
 * §10.1 CTA: a persistent bottom button, hidden when requests are paused and
 * replaced by the closed-reason banner (FR-37).
 */
function ScheduleCta({
  requestsOpen,
  closedMessage,
}: {
  requestsOpen: boolean;
  closedMessage: string | null;
}) {
  if (!requestsOpen) {
    return (
      <p
        role="status"
        className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[720px] border-t border-[--hairline] bg-[--surface-raised] px-4 py-3 text-center text-sm font-semibold safe-bottom"
      >
        {closedMessage ?? t('error.ERR_REQUESTS_CLOSED')}
      </p>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[720px] px-4 pb-2">
      <Button asChild size="lg" className="w-full shadow-lg">
        <Link href="/request">{t('schedule.cta')}</Link>
      </Button>
    </div>
  );
}

function parseWeek(value: string | undefined): LocalDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? null : value;
}
