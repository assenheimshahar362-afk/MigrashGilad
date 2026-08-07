import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getAdminIdentity } from '@/lib/auth';
import { listManagers } from '@/lib/managers';
import { ManagerTable } from '@/components/admin/manager-table';
import { Forbidden } from '@/components/admin/forbidden';

export const metadata: Metadata = { title: t('managers.title') };
export const dynamic = 'force-dynamic';

/**
 * §10.8, FR-36. Super admin only.
 *
 * FR-36b: an admin who lands here sees an explanation, not a redirect. The
 * write path is still refused by `set_manager_role()` regardless of what this
 * page renders (scenario 13).
 */
export default async function AdminManagersPage() {
  const identity = await getAdminIdentity();
  if (!identity || identity.role !== 'super_admin') return <Forbidden />;

  const managers = await listManagers(identity);

  return (
    <>
      <h1 className="mb-6 text-h2">{t('managers.title')}</h1>
      <ManagerTable managers={managers} />
    </>
  );
}
