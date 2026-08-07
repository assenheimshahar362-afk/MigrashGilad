import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getAdminIdentity } from '@/lib/auth';
import { listAccessRequests } from '@/lib/access-requests';
import { AccessQueue } from '@/components/admin/access-queue';
import { Forbidden } from '@/components/admin/forbidden';

export const metadata: Metadata = { title: t('access.title') };
export const dynamic = 'force-dynamic';

/**
 * §10.8a, the queue behind self-service sign-up. Super admin only, for the same
 * reason /admin/managers is: approving one of these writes an
 * `admin_allowlist` row, which is the only thing in the product that grants
 * anything.
 *
 * FR-36b: an ordinary admin who follows the link from an email sees an
 * explanation rather than a redirect. The write is refused by
 * `decide_access_request()` regardless of what this page renders.
 */
export default async function AdminAccessPage() {
  const identity = await getAdminIdentity();
  if (!identity || identity.role !== 'super_admin') return <Forbidden />;

  const requests = await listAccessRequests();

  return (
    <>
      <h1 className="mb-2 text-h2">{t('access.title')}</h1>
      <p className="mb-6 text-sm text-(--ink-muted)">{t('access.lead')}</p>
      <AccessQueue requests={requests} />
    </>
  );
}
