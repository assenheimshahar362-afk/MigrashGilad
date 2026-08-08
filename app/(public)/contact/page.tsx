import type { Metadata } from 'next';
import { MapPin, Clock, Map as MapIcon } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getTrustees } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { TrusteeContactGrid } from '@/components/trustees/trustee-contact-grid';

export const metadata: Metadata = { title: t('contact.title') };

/**
 * The contact page.
 *
 * The map is a static placeholder rather than a live Google Maps iframe. An
 * embed would be a third-party frame on every visit and would need a CSP
 * `frame-src` entry; the "open in maps" link below gives the same result with
 * none of that. Swap the placeholder for an embed if you want it inline.
 */
export const revalidate = 300;

export default async function ContactPage() {
  const trustees = await getTrustees();

  return (
    <section className="section">
      <div className="shell">
        <p className="text-sm font-semibold text-primary-600">{t('contact.eyebrow')}</p>
        <h1 className="mt-3 text-display">{t('contact.title')}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('contact.lead')}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          <div className="space-y-6">
            {/* The primary action. One circle per trustee, so a tap reaches a
                person rather than a page — the choice of call or WhatsApp
                happens in the sheet, once a name is picked. */}
            <div className="card p-6 sm:p-7">
              <h2 className="text-h3">{t('contact.trustees_title')}</h2>

              {trustees.length > 0 ? (
                <div className="mt-4">
                  <TrusteeContactGrid trustees={trustees} />
                </div>
              ) : (
                <p className="mt-3 text-(--ink-muted)">{t('contact.no_trustee')}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon={<MapPin className="size-5" />} label={t('contact.address')}>
                {t('contact.address_value')}
              </InfoCard>
              <InfoCard icon={<Clock className="size-5" />} label={t('contact.hours')}>
                {t('contact.hours_value')}
              </InfoCard>
            </div>
          </div>

          {/* The map panel. A live embed, not a placeholder — it needs no API
              key since it goes through the plain `output=embed` endpoint, and
              `frame-src` in next.config.ts allows exactly this one origin. */}
          <div className="card relative overflow-hidden">
            <iframe
              title={t('contact.map_title')}
              src="https://www.google.com/maps?q=%D7%A7%D7%99%D7%91%D7%95%D7%A5+%D7%92%D7%A0%D7%99%D7%92%D7%A8&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="min-h-[22rem] w-full border-0 lg:min-h-full"
            />
            <Button
              asChild
              variant="secondary"
              className="absolute bottom-4 start-1/2 -translate-x-1/2 shadow-(--shadow-md)"
            >
              <a
                href="https://www.google.com/maps/search/?api=1&query=%D7%A7%D7%99%D7%91%D7%95%D7%A5+%D7%92%D7%A0%D7%99%D7%92%D7%A8"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapIcon className="size-5" aria-hidden />
                {t('contact.map_open')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-(--radius-input) bg-primary-50 text-primary-600"
      >
        {icon}
      </span>
      <h2 className="mt-3 text-sm font-semibold text-(--ink-muted)">{label}</h2>
      <p className="mt-1 font-semibold">{children}</p>
    </div>
  );
}
