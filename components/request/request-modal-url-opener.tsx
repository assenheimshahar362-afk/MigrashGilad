'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequestModal } from '@/components/request/request-modal-context';

/**
 * Lets a link open the booking modal via `?book=1` (optionally with
 * `&date=&start=&end=` to prefill) instead of requiring a click inside the
 * page — what the PWA install shortcut (`app/manifest.ts`) uses now that
 * there is no `#request` section to land on.
 *
 * Needs `useSearchParams`, which requires its own Suspense boundary so it
 * cannot opt the rest of the public layout into dynamic rendering — that is
 * why this is its own tiny component rather than a few lines inside
 * `RequestModal`.
 */
export function RequestModalUrlOpener() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openRequestModal } = useRequestModal();

  useEffect(() => {
    if (searchParams.get('book') !== '1') return;

    openRequestModal({
      date: searchParams.get('date') ?? undefined,
      start: searchParams.get('start') ?? undefined,
      end: searchParams.get('end') ?? undefined,
    });

    // Consume the trigger so a refresh or a shared link doesn't reopen it.
    const url = new URL(window.location.href);
    for (const key of ['book', 'date', 'start', 'end']) url.searchParams.delete(key);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [searchParams, openRequestModal, router]);

  return null;
}
