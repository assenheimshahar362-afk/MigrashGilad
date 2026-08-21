'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateShort, formatRelative, formatTimeRange, localDate } from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import { formatIsraeliPhone, telLink } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import type { BookingRequestRow } from '@/lib/types';
import { StatusPill } from '@/components/ui/status-pill';
import { IconButton } from '@/components/ui/icon-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TimeRange, Ltr } from '@/components/ui/ltr';

/**
 * §10.9 `/admin/requests` list body.
 *
 * ONE dialog and one pending/error state for the whole list, not one per
 * row — this page can hold up to 200 requests, and only one delete can ever
 * be in flight at a time. Matches `EventList` / `RecurringRulesList`: each
 * row's button only decides WHICH request is being confirmed.
 */
export function RequestHistoryList({ requests }: { requests: BookingRequestRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<BookingRequestRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/requests/${deleting.id}`, {
        method: 'DELETE',
        json: { version: deleting.version },
      });
      setDeleting(null);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  if (requests.length === 0) {
    return <p className="empty-state">{t('admin.empty_generic')}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-(--hairline) card">
        {requests.map((request) => {
          const date = localDate(request.requested_start);
          return (
            <li key={request.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{request.requester_name}</span>
                <StatusPill status={request.status} className="text-xs" />
                <span className="ms-auto text-xs text-(--ink-muted)">
                  {formatRelative(request.created_at)}
                </span>
                <IconButton
                  label={`${t('admin.delete_request')} - ${request.requester_name}`}
                  onClick={() => setDeleting(request)}
                  className="text-danger-ink"
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>

              <p className="mt-1 text-xs text-(--ink-muted)">
                {formatDateShort(date)} ·{' '}
                <TimeRange range={formatTimeRange(request.requested_start, request.requested_end)} />{' '}
                · {usageTypeLabel(request.usage_type)}
              </p>

              <p className="mt-1 text-xs">
                <a href={telLink(request.requester_phone)} className="underline underline-offset-4">
                  <Ltr>{formatIsraeliPhone(request.requester_phone)}</Ltr>
                </a>
              </p>

              {request.decision_note ? (
                <p className="mt-1 text-xs text-(--ink-muted)">
                  {t('status.admin_note')}: {request.decision_note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setError(null);
          }
        }}
        title={t('admin.delete_confirm', { name: deleting?.requester_name ?? '' })}
        body={t('admin.delete_request_confirm_body')}
        confirmLabel={t('admin.delete_request')}
        pending={pending}
        onConfirm={remove}
      >
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
