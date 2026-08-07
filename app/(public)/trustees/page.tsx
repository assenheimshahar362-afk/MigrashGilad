import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getTrustees } from '@/lib/data';
import { TrusteeCard } from '@/components/trustees/trustee-card';

export const metadata: Metadata = { title: t('trustees.title') };
export const revalidate = 600;

/**
 * FR-27 / §10.5. Ordered by `display_order` (FR-29), with the primary,
 * available trustee pinned first as the on-duty contact.
 */
export default async function TrusteesPage() {
  const trustees = await getTrustees();
  const onDutyId = trustees.find((trustee) => trustee.is_primary && trustee.is_available)?.id;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 pb-24">
      <h1 className="text-h1">{t('trustees.title')}</h1>
      <p className="mt-2 text-[--ink-muted]">{t('trustees.intro')}</p>

      {trustees.length === 0 ? (
        <p className="mt-8 text-[--ink-muted]">{t('trustees.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {trustees.map((trustee) => (
            <TrusteeCard key={trustee.id} trustee={trustee} isOnDuty={trustee.id === onDutyId} />
          ))}
        </ul>
      )}
    </div>
  );
}
