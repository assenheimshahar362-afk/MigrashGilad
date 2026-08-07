import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, Phone, Map as MapIcon, ArrowLeft } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getOnDutyTrustee } from '@/lib/data';
import { formatIsraeliPhone, telLink, initials } from '@/lib/utils';
import { Ltr } from '@/components/ui/ltr';
import { Button } from '@/components/ui/button';
import { WhatsAppButton, PhoneButton } from '@/components/chrome/site-footer';

export const metadata: Metadata = { title: t('contact.title') };

/**
 * The contact page.
 *
 * §7 PII: the only phone number shown publicly is the on-duty trustee's, which
 * is already public on the header of every page. No other contact details are
 * read from the database here.
 *
 * The map is a static placeholder rather than a live Google Maps iframe. An
 * embed would be a third-party frame on every visit and would need a CSP
 * `frame-src` entry; the "open in maps" link below gives the same result with
 * none of that. Swap the placeholder for an embed if you want it inline.
 */
export const revalidate = 300;

export default async function ContactPage() {
  const onDuty = await getOnDutyTrustee();

  return (
    <section className="section">
      <div className="shell">
        <p className="text-sm font-semibold text-primary-600">{t('contact.eyebrow')}</p>
        <h1 className="mt-3 text-display">{t('contact.title')}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('contact.lead')}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          <div className="space-y-6">
            {/* The primary action. The brief asks for a large WhatsApp button,
                and it is the affordance that actually gets used at a pitch. */}
            <div className="card p-6 sm:p-7">
              <h2 className="text-h3">{t('contact.on_duty_title')}</h2>

              {onDuty ? (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <span
                      aria-hidden
                      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-50 font-display text-h3 font-bold text-primary-700"
                    >
                      {initials(onDuty.full_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-h3 font-bold">{onDuty.full_name}</p>
                      {onDuty.title ? (
                        <p className="truncate text-sm text-(--ink-muted)">{onDuty.title}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {onDuty.whatsapp_ok ? (
                      <WhatsAppButton phone={onDuty.phone_e164} className="w-full sm:w-auto" />
                    ) : null}
                    <PhoneButton phone={onDuty.phone_e164} className="w-full sm:w-auto" />
                  </div>

                  <p className="mt-4 flex items-center gap-2 text-sm text-(--ink-muted)">
                    <Phone className="size-4 shrink-0" aria-hidden />
                    <a
                      href={telLink(onDuty.phone_e164)}
                      className="underline decoration-(--hairline-strong) underline-offset-4 transition-colors hover:text-(--ink) hover:decoration-current"
                    >
                      <Ltr>{formatIsraeliPhone(onDuty.phone_e164)}</Ltr>
                    </a>
                  </p>
                </>
              ) : (
                <p className="mt-3 text-(--ink-muted)">{t('contact.no_trustee')}</p>
              )}

              <Button asChild variant="quiet" className="mt-5 px-0">
                <Link href="/trustees">
                  {t('contact.all_trustees')}
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
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

          {/* The map panel. */}
          <div className="card overflow-hidden">
            <div className="relative flex min-h-[22rem] flex-col items-center justify-center gap-4 bg-(--surface-sunken) p-8 text-center lg:min-h-full">
              {/* A faint street-grid so the panel reads as a map slot rather
                  than as an empty box. */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    'linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />
              <span
                aria-hidden
                className="relative flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-(--shadow-md)"
              >
                <MapIcon className="size-6" />
              </span>
              <div className="relative">
                <h2 className="text-h3">{t('contact.map_title')}</h2>
                <p className="mx-auto mt-2 max-w-[34ch] text-sm text-(--ink-muted)">
                  {t('contact.map_placeholder')}
                </p>
              </div>
              <Button asChild variant="secondary" className="relative">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t('contact.address_value'))}`}
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
