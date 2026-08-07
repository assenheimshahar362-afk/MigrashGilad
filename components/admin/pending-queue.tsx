'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import type { BookingRequestRow } from '@/lib/types';
import { RequestCard } from '@/components/admin/request-card';

/**
 * §10.7 pending queue, sorted by requested start time ascending (FR-32).
 *
 * Realtime: subscribed to `booking_requests` so a SECOND admin's decision
 * removes the card here immediately, with a toast (FR-20 — the first decision
 * wins, and the loser should find out before they tap, not after).
 *
 * The subscription uses the admin's own anon-key session, so RLS decides what
 * they may see; a revoked admin's socket returns nothing.
 */
export function PendingQueue({ initial }: { initial: BookingRequestRow[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);

  // Keep in step with a server refresh (after an approve, or a navigation).
  useEffect(() => setRequests(initial), [initial]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('admin-pending-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_requests' },
        (payload) => {
          const row = payload.new as BookingRequestRow;
          if (row.status !== 'pending') return;
          setRequests((current) =>
            current.some((request) => request.id === row.id)
              ? current
              : [...current, row].sort((a, b) =>
                  a.requested_start.localeCompare(b.requested_start),
                ),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'booking_requests' },
        (payload) => {
          const row = payload.new as BookingRequestRow;
          if (row.status === 'pending') return;

          setRequests((current) => {
            if (!current.some((request) => request.id === row.id)) return current;
            setToast(t('admin.handled_by', { name: row.requester_name }));
            return current.filter((request) => request.id !== row.id);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const remove = (id: string) => setRequests((current) => current.filter((r) => r.id !== id));

  if (requests.length === 0) {
    return (
      <div className="rounded-[--radius-card] border border-dashed border-[--hairline] p-8 text-center">
        <p className="font-semibold">{t('admin.pending_empty')}</p>
        <p className="mt-1 text-sm text-[--ink-muted]">{t('admin.pending_empty_help')}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onResolved={(id) => {
              remove(id);
              router.refresh();
            }}
          />
        ))}
      </ul>

      {/* A11Y-7: toasts are polite; only a submission failure is assertive. */}
      {toast ? (
        <p
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[--radius-card] bg-pitch-700 px-4 py-3 text-center text-sm font-semibold text-chalk-050 shadow-lg"
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}
