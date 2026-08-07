import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addLocalDays, todayLocal, toInstant } from '@/lib/time';
import type { EventRow } from '@/lib/types';
import { EventEditor } from '@/components/admin/event-editor';
import { EventList } from '@/components/admin/event-list';

export const metadata: Metadata = { title: t('calendar.title') };
export const dynamic = 'force-dynamic';

/** §10.9 `/admin/calendar` — create, edit and delete events (FR-33). */
export default async function AdminCalendarPage() {
  await requireAdmin();

  const from = toInstant(todayLocal(), '00:00').toISOString();
  const to = toInstant(addLocalDays(todayLocal(), 60), '00:00').toISOString();

  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'scheduled')
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at');

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-h2">{t('admin.create_event')}</h1>
        <div className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
          <EventEditor />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('calendar.title')}</h2>
        <EventList events={(data ?? []) as EventRow[]} />
      </section>
    </div>
  );
}
