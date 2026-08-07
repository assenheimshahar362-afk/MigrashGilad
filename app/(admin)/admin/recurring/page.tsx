import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { RecurringRuleRow } from '@/lib/types';
import { RecurringManager } from '@/components/admin/recurring-manager';

export const metadata: Metadata = { title: t('recurring.title') };
export const dynamic = 'force-dynamic';

export default async function AdminRecurringPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from('recurring_rules')
    .select('*')
    .order('weekday')
    .order('start_time');

  return (
    <>
      <h1 className="mb-6 text-h2">{t('recurring.title')}</h1>
      <RecurringManager rules={(data ?? []) as RecurringRuleRow[]} />
    </>
  );
}
