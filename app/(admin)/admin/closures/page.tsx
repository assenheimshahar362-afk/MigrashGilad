import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ClosureRow } from '@/lib/types';
import { ClosureManager } from '@/components/admin/closure-manager';

export const metadata: Metadata = { title: t('closures.title') };
export const dynamic = 'force-dynamic';

export default async function AdminClosuresPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from('closures')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(100);

  return (
    <>
      <h1 className="mb-6 text-h2">{t('closures.title')}</h1>
      <ClosureManager closures={(data ?? []) as ClosureRow[]} />
    </>
  );
}
