import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { TrusteeRow } from '@/lib/types';
import { TrusteeManager } from '@/components/admin/trustee-manager';

export const metadata: Metadata = { title: t('trustees.title') };
export const dynamic = 'force-dynamic';

export default async function AdminTrusteesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from('trustees')
    .select('*')
    .order('is_archived')
    .order('display_order');

  return (
    <>
      <h1 className="mb-6 text-h2">{t('admin.nav.trustees')}</h1>
      <TrusteeManager trustees={(data ?? []) as TrusteeRow[]} />
    </>
  );
}
