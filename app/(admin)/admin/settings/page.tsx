import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/data';
import { t } from '@/lib/i18n';
import { SettingsForm } from '@/components/admin/settings-form';

export const metadata: Metadata = { title: t('settings.title') };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const [openingTime, closingTime] = settings.openingHours['0'] ?? ['07:00', '23:00'];

  return (
    <>
      <h1 className="mb-6 text-h2">{t('settings.title')}</h1>
      <SettingsForm openingTime={openingTime} closingTime={closingTime} />
    </>
  );
}