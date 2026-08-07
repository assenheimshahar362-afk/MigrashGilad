'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker. That registration is what makes the schedule
 * readable at the pitch gate with no signal, so it stays.
 *
 * There is deliberately NO "a new version is available" prompt. A waiting
 * worker takes over the next time every tab of the site is closed, which is the
 * browser's own default — and it still never reloads the page underneath
 * someone who is halfway through the request form, which was the rule that
 * prompt existed to satisfy in the first place.
 */
export function ServiceWorkerBridge() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV === 'development') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // A failed registration degrades to a normal website; nothing to do.
    });
  }, []);

  return null;
}
