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
      <div className="mx-auto max-w-[720px] px-4 py-8">
        <h1 className="text-h1">{t('request.closed_title')}</h1>
        <p className="mt-3 text-[--ink-muted]">
          {settings.requestsClosedMsg ?? t('error.ERR_REQUESTS_CLOSED')}
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/">{t('common.back_home')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 pb-28">
      <h1 className="mb-6 text-h1">{t('request.title')}</h1>
      <RequestForm
        settings={settings}
        prefill={{
          date: sanitiseDate(params.date),
          start: sanitiseTime(params.start),
          end: sanitiseTime(params.end),
        }}
      />
    </div>
  );
}

function sanitiseDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function sanitiseTime(value: string | undefined): string | undefined {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : undefined;
}
