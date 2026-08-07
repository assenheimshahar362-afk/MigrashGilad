import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarRange } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
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
import { Hero } from '@/components/marketing/hero';

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
    <>
      <Hero />

      <section id="schedule" className="scroll-mt-24 pb-28 lg:pb-16">
        <div className="shell pt-8 sm:pt-10 lg:pt-14">
          {/* The hero carries this page's <h1>; the schedule is a section
              within it. Visually the week range in <WeekNav> is the heading, so
              this one is for the accessibility tree only. */}
          <h2 className="sr-only">
            {t('schedule.title')} — {t('schedule.week_of', { range: formatWeekRange(weekStart) })}
          </h2>

          <OfflineBanner />

          <WeekNav weekStart={weekStart} />

          {bannerClosure ? (
            <p
              role="status"
              className="closure-hatch animate-fade-in mb-3 rounded-(--radius-card-sm) border border-danger/30 bg-danger/8 px-4 py-3 text-sm font-semibold text-danger-ink"
            >
              {t('schedule.closed_banner', { reason: bannerClosure.reason })}
            </p>
          ) : null}

          <WeekGrid weekStart={weekStart} events={events} closures={closures} settings={settings} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Legend />

            <Link
              href="/schedule/month"
              className={cn(
                'press-sm inline-flex items-center gap-1.5 rounded-(--radius-input) px-4 py-2',
                'text-sm font-semibold text-(--ink-muted)',
                'border border-(--hairline) bg-(--surface-raised)',
                'transition-[background-color,border-color,color] duration-(--duration-tip)',
                'ease-(--ease-out-quiet) hover:border-(--hairline-strong) hover:text-(--ink)',
              )}
            >
              <CalendarRange className="size-4" aria-hidden />
              {t('nav.month')}
            </Link>
          </div>

          {isEmpty ? (
            <p className="empty-state mt-4">{t('schedule.empty')}</p>
          ) : null}

          {/* A11Y-5: the screen-reader alternative to the grid. */}
          <DayList dates={days} events={events} headingId="week-sr-list" />
        </div>
      </section>

      <ScheduleCta
        requestsOpen={settings.requestsOpen}
        closedMessage={settings.requestsClosedMsg}
      />
    </>
  );
}

/**
 * §10.1 CTA: a persistent bottom button, hidden when requests are paused and
 * replaced by the closed-reason banner (FR-37).
 *
 * It is docked above the tab bar on a phone, where the schedule fills the
 * screen and the button is the only way forward. From `lg` — where the hero
 * already carries the same call to action and the tab bar is gone — it is not
 * rendered at all, because a floating button over a desktop layout is clutter.
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
      <div className="fixed inset-x-0 bottom-[4.5rem] z-20 mx-auto max-w-[560px] px-4 lg:hidden">
        <p
          role="status"
          className="card animate-rise-in px-4 py-3 text-center text-sm font-semibold text-(--ink-muted)"
        >
          {closedMessage ?? t('error.ERR_REQUESTS_CLOSED')}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] z-20 mx-auto max-w-[560px] px-4 lg:hidden">
      <Button asChild size="lg" className="animate-rise-in w-full shadow-(--shadow-lg)">
        <Link href="/request">{t('schedule.cta')}</Link>
      </Button>
    </div>
  );
}

function parseWeek(value: string | undefined): LocalDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? null : value;
}
