import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/data';
import { RequestForm } from '@/components/request/request-form';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: t('request.title') };

/** The form must always reflect current settings, so this route is dynamic. */
export const dynamic = 'force-dynamic';

/**
 * §10.3 / FR-11. G2: name + phone + slot, five fields, no account.
 *
 * FR-10: arriving from an empty slot in the grid pre-fills the date and time
 * through the query string.
 */
export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; start?: string; end?: string }>;
}) {
  const [params, settings] = await Promise.all([searchParams, getSettings()]);

  if (!settings.requestsOpen) {
    return (
      <section className="section">
        <div className="shell-narrow">
          <div className="card p-8 text-center">
            <h1 className="text-h1">{t('request.closed_title')}</h1>
            <p className="mt-3 text-(--ink-muted)">
              {settings.requestsClosedMsg ?? t('error.ERR_REQUESTS_CLOSED')}
            </p>
            <Button asChild variant="secondary" className="mt-7">
              <Link href="/">{t('common.back_home')}</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section pb-28 lg:pb-24">
      <div className="shell-narrow">
        <p className="text-sm font-semibold text-primary-600">{t('app.tagline')}</p>
        <h1 className="mt-3 text-display">{t('request.title')}</h1>

        {/* The form sits on a card. On a three-step flow the card edge is what
            tells you the steps belong to one thing rather than being three
            successive pages. */}
        <div className="card mt-8 p-6 sm:p-8">
          <RequestForm
            settings={settings}
            prefill={{
              date: sanitiseDate(params.date),
              start: sanitiseTime(params.start),
              end: sanitiseTime(params.end),
            }}
          />
        </div>
      </div>
    </section>
  );
}

function sanitiseDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function sanitiseTime(value: string | undefined): string | undefined {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : undefined;
}
