import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addLocalDays, startOfLocalWeek, todayLocal, toInstant } from '@/lib/time';
import type { EventRow, RecurringRuleRow } from '@/lib/types';
import { EventEditor } from '@/components/admin/event-editor';
import { EventList } from '@/components/admin/event-list';
import { RecurringRulesList } from '@/components/admin/recurring-rules-list';

export const metadata: Metadata = { title: t('calendar.title') };
export const dynamic = 'force-dynamic';

/** §10.9 `/admin/calendar` — create, edit and delete events (FR-33). */
export default async function AdminCalendarPage() {
  await requireAdmin();

  const today = todayLocal();
  const from = toInstant(startOfLocalWeek(today), '00:00').toISOString();
  const to = toInstant(addLocalDays(today, 60), '00:00').toISOString();

  const supabase = await createClient();
  const [{ data }, { data: rules }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('status', 'scheduled')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at'),
    supabase.from('recurring_rules').select('*').order('weekday').order('start_time'),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-h2">{t('admin.create_event')}</h1>
        <div className="card p-4">
          <EventEditor />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('calendar.title')}</h2>
        <EventList events={(data ?? []) as EventRow[]} />
      </section>

      {/* FR-34: recurring series are created above, from the event form's
          "אירוע חוזר" toggle. This is where the series themselves — as
          opposed to the individual occurrences they generate — are seen and,
          if needed, withdrawn entirely. */}
      <section>
        <h2 className="mb-3 text-h3">{t('recurring.title')}</h2>
        <RecurringRulesList rules={(rules ?? []) as RecurringRuleRow[]} />
      </section>
    </div>
  );
}
