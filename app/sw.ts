/// <reference lib="webworker" />

import {
  BackgroundSyncQueue,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * §12 PWA. Serwist, not a hand-rolled service worker.
 *
 * The governing constraint is that the pitch has poor signal: the schedule must
 * be readable while standing at the gate with no bars, and a request submitted
 * there must not be lost.
 */

/** §12: queue failed request submissions with Background Sync. */
const requestQueue = new BackgroundSyncQueue('migrash-requests', {
  maxRetentionTime: 24 * 60, // minutes
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // §12 update flow: never reload without user action.
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // The schedule must be readable offline (§12). Stale-while-revalidate so
      // the visitor sees something instantly and the fresh copy lands behind it.
      matcher: ({ url, request }) =>
        request.method === 'GET' && url.pathname.startsWith('/api/schedule'),
      handler: new StaleWhileRevalidate({
        cacheName: 'schedule-api',
        plugins: [
          new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'font',
      handler: new CacheFirst({
        cacheName: 'fonts',
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      // All POSTs are network-only. A cached write would be a lie.
      matcher: ({ request }) => request.method === 'POST',
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.mode === 'navigate',
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Background Sync for the one write that must survive a dead signal: a booking
 * request. The cancel endpoint is deliberately NOT queued — replaying a cancel
 * hours later, after an admin may have already approved it, would be worse than
 * failing loudly.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;

  const url = new URL(event.request.url);
  if (url.pathname !== '/api/requests') return;

  event.respondWith(
    fetch(event.request.clone()).catch(async (error) => {
      await requestQueue.pushRequest({ request: event.request });
      throw error;
    }),
  );
});

/** §9.1: push payload carries the deep link and the two actions. */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json() as {
    title: string;
    body: string;
    url: string;
    tag?: string;
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: payload.url },
      // `actions` is part of the Notifications API for service workers but is
      // absent from TypeScript's DOM `NotificationOptions`, which describes the
      // window-context constructor. G3 needs the approve action ON the
      // notification, so the cast stays.
      actions: [
        { action: 'approve', title: 'לאישור' },
        { action: 'open', title: 'פתיחה' },
      ],
    } as NotificationOptions & {
      actions: Array<{ action: string; title: string }>;
    }),
  );
});

/** G3: the approve/reject action is reachable from the notification itself. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const base = (event.notification.data as { url?: string } | undefined)?.url ?? '/admin';
  const target = event.action === 'approve' ? `${base}&action=approve` : base;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/** §12 update flow: the page asks to skip waiting, never the worker itself. */
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
