'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateLong, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import type { PublicRequestView } from '@/lib/types';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { TimeRange } from '@/components/ui/ltr';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * §10.4 status page body. No login, and no other person's data is reachable
 * from here — the server has already reduced the row to a `PublicRequestView`.
 *
 * The cancel button exists only while `pending` (§5); for every other state it
 * is absent, not disabled, so there is nothing to explain.
 */
export function StatusCard({
  request,
  token,
}: {
  request: PublicRequestView;
  token: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = request.status === 'approved' || request.status === 'approved_modified';
  const start = request.finalStart ?? request.requestedStart;
  const end = request.finalEnd ?? request.requestedEnd;

  const cancel = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${token}/cancel`, { method: 'POST' });
      const payload = (await response.json()) as
        | { status: string }
        | { error: { code: string; message: string } };

      if (!response.ok || 'error' in payload) {
        setError('error' in payload ? payload.error.message : t('error.generic'));
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError(t('error.generic'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1">{t('status.title')}</h1>
        <StatusPill status={request.status} />
      </div>

      <section className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="text-sm font-semibold text-[--ink-muted]">
          {approved ? t('status.final_slot') : t('status.requested_slot')}
        </h2>
        <p className="mt-1 font-semibold">
          {formatWeekdayLong(localDate(start))}, {formatDateLong(localDate(start))}
        </p>
        <TimeRange range={formatTimeRange(start, end)} className="mt-1 block text-h3" />
        <p className="mt-2 text-sm text-[--ink-muted]">{usageTypeLabel(request.usageType)}</p>

        {/* FR-23: when the time was changed on approval, show both, so the
            requester is not left comparing against a half-remembered request. */}
        {request.status === 'approved_modified' ? (
          <p className="mt-3 border-t border-[--hairline] pt-3 text-sm text-[--ink-muted]">
            {t('status.requested_slot')}:{' '}
            <TimeRange range={formatTimeRange(request.requestedStart, request.requestedEnd)} />
          </p>
        ) : null}
      </section>

      {request.decisionNote ? (
        <section className="rounded-[--radius-card] border border-[--hairline] p-4">
          <h2 className="text-sm font-semibold text-[--ink-muted]">{t('status.admin_note')}</h2>
          <p className="mt-1">{request.decisionNote}</p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-signal-err">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {approved ? (
          <Button asChild variant="secondary">
            <a href={`/api/requests/${token}/ics`} download>
              <CalendarPlus className="size-5" aria-hidden />
              {t('status.add_to_calendar')}
            </a>
          </Button>
        ) : null}

        {request.cancellable ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t('request.cancel')}
          </Button>
        ) : null}

        <Button asChild variant="quiet">
          <Link href="/">{t('common.back_home')}</Link>
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('request.cancel_confirm')}
        body={t('request.cancel_confirm_body')}
        confirmLabel={t('request.cancel_yes')}
        cancelLabel={t('request.cancel_no')}
        pending={pending}
        onConfirm={cancel}
      />
    </div>
  );
}
