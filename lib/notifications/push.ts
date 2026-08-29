import 'server-only';

import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import { logNotification } from '@/lib/notifications/log';

let configured = false;

/** Validate and install the server-side VAPID key pair once per process. */
export function ensurePushConfigured(): void {
  if (configured) return;

  // The browser-facing key is canonical: it is the key every existing
  // PushSubscription was created with. `VAPID_PUBLIC_KEY` remains a fallback
  // for older deployments, but a duplicated server value cannot silently
  // drift away from the client bundle.
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  // VAPID wants a contact address, not an email account — this reuses
  // whichever one is already configured for outgoing mail rather than asking
  // for a third env var.
  const contact = (
    process.env.NOTIFY_FROM_EMAIL ??
    process.env.GMAIL_USER ??
    'admin@example.com'
  ).trim();
  if (!publicKey || !privateKey) throw new Error('VAPID keys not configured');

  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  requestId?: string;
  /**
   * How many requests are waiting, for the number on the app icon
   * (§ lib/app-badge.ts). Carried in the payload rather than fetched by the
   * service worker: at push time the app is closed and the worker holds no
   * session, so it cannot ask the API for a count of its own.
   */
  badgeCount?: number;
}

/**
 * §9.1 step 1: Web Push to every subscription belonging to an admin with
 * `notify_push = true`.
 *
 * A 404 or 410 from the push service means the browser threw the subscription
 * away; the row is deleted rather than retried forever, otherwise every future
 * fan-out pays for a dead endpoint.
 */
export async function pushToAdmins(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  try {
    ensurePushConfigured();
  } catch (error) {
    reportError(error, { where: 'pushToAdmins.configure' });
    await logNotification({
      channel: 'push',
      target: 'admins',
      status: 'failed',
      error: errorMessage(error),
      payload,
    });
    return { sent: 0, failed: 1 };
  }

  const supabase = createAdminClient();

  const { data: allowlist, error: allowlistError } = await supabase
    .from('admin_allowlist')
    .select('email')
    .is('revoked_at', null)
    .eq('notify_push', true);

  if (allowlistError) {
    return logFanOutFailure(allowlistError, 'Could not load push recipients', payload);
  }

  const emails = (allowlist ?? []).map((row) => (row.email as string).toLowerCase());
  if (emails.length === 0) {
    return logFanOutFailure(null, 'No active managers have push enabled', payload);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('admin_profiles')
    .select('user_id, email');

  if (profilesError) {
    return logFanOutFailure(profilesError, 'Could not resolve manager accounts', payload);
  }

  const userIds = (profiles ?? [])
    .filter((profile) => emails.includes((profile.email as string).toLowerCase()))
    .map((profile) => profile.user_id as string);

  if (userIds.length === 0) {
    return logFanOutFailure(null, 'No active manager accounts have signed in', payload);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (subscriptionsError) {
    return logFanOutFailure(subscriptionsError, 'Could not load push subscriptions', payload);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return logFanOutFailure(null, 'No active manager devices are subscribed', payload);
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      const target = subscription.endpoint as string;
      try {
        await webpush.sendNotification(
          {
            endpoint: target,
            keys: { p256dh: subscription.p256dh as string, auth: subscription.auth as string },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60, timeout: 5_000 },
        );
        sent += 1;
        await logNotification({ channel: 'push', target, status: 'sent', payload });
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
        } else {
          reportError(error, { where: 'pushToAdmins', target });
        }
        await logNotification({
          channel: 'push',
          target,
          status: 'failed',
          error: errorMessage(error),
          payload,
        });
      }
    }),
  );

  return { sent, failed };
}

async function logFanOutFailure(
  cause: unknown,
  message: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (cause) reportError(cause, { where: 'pushToAdmins', message });
  await logNotification({
    channel: 'push',
    target: 'admins',
    status: 'failed',
    error: cause ? `${message}: ${errorMessage(cause)}` : message,
    payload,
  });
  return { sent: 0, failed: 1 };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
