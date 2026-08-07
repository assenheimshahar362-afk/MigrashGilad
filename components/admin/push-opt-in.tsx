'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/**
 * §9.1 iOS caveat: Web Push on iOS requires the PWA to be INSTALLED to the home
 * screen and works from iOS 16.4+. The admin onboarding must explain this in
 * Hebrew and detect whether the app is running standalone.
 *
 * That detection is why this component is more than a button: on iOS Safari in
 * a normal tab, `Notification.requestPermission()` either does not exist or
 * fails silently, and an admin who taps it would believe they are covered when
 * they are not.
 */
export function PushOptIn() {
  const [state, setState] = useState<'hidden' | 'prompt' | 'needs-install' | 'enabled'>('hidden');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (isIos()) setState('needs-install');
      return;
    }

    if (Notification.permission === 'granted') {
      setState('enabled');
      return;
    }

    if (Notification.permission === 'denied') return;

    if (isIos() && !isStandalone()) {
      setState('needs-install');
      return;
    }

    setState('prompt');
  }, []);

  if (state === 'hidden') return null;

  if (state === 'enabled') {
    return (
      <p className="flex items-center gap-2 rounded-(--radius-card) bg-success/10 px-4 py-2 text-sm font-semibold">
        <BellRing className="size-4" aria-hidden />
        {t('pwa.push_enabled')}
      </p>
    );
  }

  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 font-bold">
        <Bell className="size-5 text-accent-ink" aria-hidden />
        {t('pwa.push_title')}
      </p>

      {state === 'needs-install' ? (
        <>
          <p className="mt-1 text-sm text-(--ink-muted)">{t('pwa.push_body')}</p>
          <p className="mt-1 text-sm text-(--ink-muted)">{t('pwa.install_ios')}</p>
        </>
      ) : (
        <Button
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const granted = await subscribe();
              setState(granted ? 'enabled' : 'prompt');
            } finally {
              setPending(false);
            }
          }}
        >
          {t('pwa.push_enable')}
        </Button>
      )}
    </div>
  );
}

async function subscribe(): Promise<boolean> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    }));

  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;

  const response = await fetch('/api/admin/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent.slice(0, 500),
    }),
  });

  return response.ok;
}

/**
 * The VAPID key travels as base64url and `applicationServerKey` wants raw
 * bytes. The buffer is allocated explicitly as an ArrayBuffer so the result is
 * a `Uint8Array<ArrayBuffer>` rather than the `ArrayBufferLike` that
 * `Uint8Array.from` produces — `BufferSource` does not accept the latter.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}
