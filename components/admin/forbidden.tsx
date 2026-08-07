import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/**
 * FR-36b: an admin who opens /admin/managers, /admin/settings or /admin/audit
 * gets a 403 page EXPLAINING that the section is limited to the super admin —
 * not a redirect that looks like a bug.
 *
 * The distinction matters operationally: an admin bounced to the dashboard with
 * no explanation files a support request. An admin who reads this sentence does
 * not.
 */
export function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <ShieldAlert className="mx-auto size-10 text-ink-2" aria-hidden />
      <h1 className="mt-4 text-h2">{t('error.forbidden_title')}</h1>
      <p className="mt-2 text-(--ink-muted)">{t('error.ERR_SUPER_ONLY')}</p>
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/admin">{t('admin.nav.dashboard')}</Link>
      </Button>
    </div>
  );
}
