'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { BookingRequestRow } from '@/lib/types';
import { RequestCard } from '@/components/admin/request-card';
import { AppBadgeSync } from '@/components/admin/app-badge-sync';

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
      <div className="empty-state">
        {/* Mounted on this branch too, and deliberately: an empty queue is
            precisely when the app icon's badge has to be cleared. */}
        <AppBadgeSync count={0} />
        <p className="font-semibold">{t('admin.pending_empty')}</p>
        <p className="mt-1 text-sm text-(--ink-muted)">{t('admin.pending_empty_help')}</p>
      </div>
    );
  }

  return (
    <>
      <AppBadgeSync count={requests.length} />

      {/* The queue is the first thing an admin sees on opening the dashboard, so
          the cards cascade in. It happens once per session, which is the only
          frequency at which a stagger is worth its 240ms. */}
      <ul className="stagger space-y-3">
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
          /* The toast rises from below and keeps its exit in the same
             direction, which is what makes a swipe-down feel like the obvious
             way to dismiss it even though it is only ever timed out. */
          className={cn(
            'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px]',
            'rounded-(--radius-card) border border-white/10 bg-primary-600',
            'px-4 py-3 text-center text-sm font-semibold text-white',
            'shadow-[0_4px_10px_rgb(7_24_17/0.25),0_16px_40px_-12px_rgb(7_24_17/0.55)]',
            'animate-[toast-in_320ms_var(--ease-out-quiet)_both]',
          )}
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}
