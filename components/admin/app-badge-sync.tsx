'use client';

import { useEffect } from 'react';
import { setAppBadgeCount } from '@/lib/app-badge';

/**
 * Keeps the number on the app icon in step with the queue while the admin is
 * actually looking at it.
 *
 * The service worker sets the badge when a push arrives (§ app/sw.ts), which
 * covers the app being closed. This covers everything else — and it is the half
 * that CLEARS it. Without this the badge would only ever count up: approve the
 * last request and the icon would still be wearing a 3, because no push is sent
 * when a queue empties.
 *
 * Mounted with the live count from `<PendingQueue>` rather than the server's
 * first render, so it also follows the realtime channel — another admin
 * deciding a request drops this admin's badge too, with no reload.
 */
export function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    void setAppBadgeCount(count);
  }, [count]);

  return null;
}
