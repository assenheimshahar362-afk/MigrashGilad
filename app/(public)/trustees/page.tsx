import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getTrustees } from '@/lib/data';
import { TrusteeCard } from '@/components/trustees/trustee-card';

export const metadata: Metadata = { title: t('trustees.title') };
export const revalidate = 600;

/**
 * FR-27 / §10.5. Ordered by `display_order` (FR-29).
 *
 * The grid tops out at three columns rather than four: these are people, and
 * four-up shrinks each card to the point where the name is the only thing left
 * on it.
 */
export default async function TrusteesPage() {
  const trustees = await getTrustees();

  return (
    <section className="section">
      <div className="shell">
        <h1 className="text-display">{t('trustees.title')}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('trustees.intro')}</p>

        {trustees.length === 0 ? (
          <p className="empty-state mt-10">{t('trustees.empty')}</p>
        ) : (
          <ul className="stagger mt-10 grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {trustees.map((trustee) => (
              <TrusteeCard key={trustee.id} trustee={trustee} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
