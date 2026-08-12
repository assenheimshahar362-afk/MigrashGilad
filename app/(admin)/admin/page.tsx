import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSchedule } from '@/lib/data';
import { addLocalDays, localWeekDays, startOfLocalWeek, todayLocal } from '@/lib/time';
import type { BookingRequestRow } from '@/lib/types';
import { PendingQueue } from '@/components/admin/pending-queue';
import { PushOptIn } from '@/components/admin/push-opt-in';
import { DayList } from '@/components/schedule/day-list';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: t('admin.pending') };
export const dynamic = 'force-dynamic';

/**
 * §10.7 / FR-32: the dashboard defaults to the pending-requests queue, sorted
 * by requested start time ascending, with a count badge.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_start', { ascending: true });

  const pending = (data ?? []) as BookingRequestRow[];

  const weekStart = startOfLocalWeek(todayLocal());
  const { events } = await getSchedule(weekStart, addLocalDays(weekStart, 6));

  return (
    <div className="space-y-8">
      <PushOptIn />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-h2">{t('admin.pending')}</h1>
          {pending.length > 0 ? (
            <span className="tnum rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-white">
              {pending.length}
            </span>
          ) : null}
        </div>

        <PendingQueue initial={pending} />
      </section>

      {/* §10.7 secondary tabs: this week's schedule and a quick "create event". */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-h3">{t('schedule.title')}</h2>
          <Button asChild size="sm" variant="secondary" className="ms-auto">
            <Link href="/admin/calendar">{t('admin.create_event')}</Link>
          </Button>
        </div>

        <div className="card px-4">
          <DayList dates={localWeekDays(weekStart)} events={events} visuallyHidden={false} />
        </div>
      </section>
    </div>
  );
}
