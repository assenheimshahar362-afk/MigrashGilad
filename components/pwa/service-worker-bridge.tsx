'use client';

import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/**
 * §12 update flow: on a new service worker, show a toast with a "refresh"
 * action. NEVER reload without user action — someone may be halfway through
 * the request form, and losing it to a silent reload is the exact failure the
 * spec forbids.
 */
export function ServiceWorkerBridge() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV === 'development') return;

    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;

        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        // A failed registration degrades to a normal website; nothing to do.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-[720px] items-center gap-3 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] px-4 py-3 shadow-lg"
    >
      <span className="flex-1 text-sm font-semibold">{t('pwa.update_title')}</span>
      <Button
        size="sm"
        onClick={() => {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          waiting.addEventListener('statechange', () => {
            if (waiting.state === 'activated') window.location.reload();
          });
        }}
      >
        {t('pwa.update_action')}
      </Button>
    </div>
  );
}
