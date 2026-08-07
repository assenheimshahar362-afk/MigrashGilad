import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getRequestByToken } from '@/lib/data';
import { toPublicRequestView, type BookingRequestRow } from '@/lib/types';
import { StatusCard } from '@/components/request/status-card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: t('status.title'),
  // A status page is personal to whoever holds the link. It must never end up
  // in a search index.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * §10.4 `/request/[token]`. The token is the authorisation — there is no login,
 * and §2 is explicit that there is no visitor account and therefore no "my
 * requests" list. This page is the whole continuity model.
 */
export default async function RequestStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = (await getRequestByToken(token)) as BookingRequestRow | null;

  if (!row) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10 pb-28">
        <h1 className="text-h1">{t('status.not_found')}</h1>
        <p className="mt-3 text-[--ink-muted]">{t('status.not_found_help')}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/trustees">{t('nav.trustees')}</Link>
          </Button>
          <Button asChild variant="quiet">
            <Link href="/">{t('common.back_home')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 pb-28">
      <StatusCard request={toPublicRequestView(row)} token={token} />
    </div>
  );
}
