import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getAdminIdentity } from '@/lib/auth';
import { getSettingsRow } from '@/lib/data';
import { SettingsForm } from '@/components/admin/settings-form';
import { Forbidden } from '@/components/admin/forbidden';

export const metadata: Metadata = { title: t('settings.title') };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const identity = await getAdminIdentity();
  if (!identity || identity.role !== 'super_admin') return <Forbidden />;

  const settings = await getSettingsRow();
  if (!settings) {
    return (
      <p role="alert" className="text-sm font-semibold text-signal-err">
        {t('error.generic')}
      </p>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-h2">{t('settings.title')}</h1>
      <SettingsForm settings={settings} />
    </>
  );
}
