'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { t } from '@/lib/i18n';
import { apiFetch } from '@/lib/client-api';
import { Button } from '@/components/ui/button';

type PushState = 'checking' | 'hidden' | 'prompt' | 'needs-install' | 'blocked' | 'enabled';

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
  const [state, setState] = useState<PushState>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      const availability = detectPushState();
      if (availability !== 'ready') {
        if (active) setState(availability);
        return;
      }

      if (Notification.permission !== 'granted') {
        if (active) setState('prompt');
        return;
      }

      // Permission alone is not delivery. Recreate a missing/stale browser
      // subscription and upsert it on every dashboard visit before saying the
      // device is enabled.
      try {
        await subscribe(false);
        if (active) setState('enabled');
      } catch {
        if (active) {
          setError(true);
          setState('prompt');
        }
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking' || state === 'hidden') return null;

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
      ) : state === 'blocked' ? (
        <p className="mt-1 text-sm text-danger-ink">{t('pwa.push_blocked')}</p>
      ) : (
        <>
          {error ? (
            <p role="alert" className="mt-1 text-sm text-danger-ink">
              {t('pwa.push_error')}
            </p>
          ) : null}
          <Button
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(false);
              try {
                await subscribe(true);
                setState('enabled');
              } catch {
                setError(true);
                setState(Notification.permission === 'denied' ? 'blocked' : 'prompt');
              } finally {
                setPending(false);
              }
            }}
          >
            {pending
              ? t('pwa.push_enabling')
              : error
                ? t('pwa.push_retry')
                : t('pwa.push_enable')}
          </Button>
        </>
      )}
    </div>
  );
}

async function subscribe(requestPermission: boolean): Promise<void> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) throw new Error('Public VAPID key is not configured');

  const permission =
    requestPermission && Notification.permission !== 'granted'
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapid);
  let existing = await registration.pushManager.getSubscription();

  // A VAPID rotation leaves a browser subscription tied to the old public
  // key. Reusing it makes every server send fail; replace it while permission
  // is still granted instead of showing a false green state.
  if (
    existing &&
    !applicationServerKeysMatch(existing.options.applicationServerKey, applicationServerKey)
  ) {
    await existing.unsubscribe();
    existing = null;
  }

  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }));

  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Browser returned an incomplete push subscription');
  }

  await apiFetch('/api/admin/push/subscribe', {
    method: 'POST',
    json: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent.slice(0, 500),
    },
  });
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

function applicationServerKeysMatch(
  current: ArrayBuffer | null,
  expected: Uint8Array<ArrayBuffer>,
): boolean {
  if (!current) return true;
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
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

function detectPushState(): Exclude<PushState, 'checking' | 'enabled' | 'prompt'> | 'ready' {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return isIos() ? 'needs-install' : 'hidden';
  }
  if (isIos() && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ready';
}
