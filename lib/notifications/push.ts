import 'server-only';

import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import { logNotification } from '@/lib/notifications/log';

let configured = false;

function configure(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // VAPID wants a contact address, not an email account — this reuses
  // whichever one is already configured for outgoing mail rather than asking
  // for a third env var.
  const contact = process.env.NOTIFY_FROM_EMAIL ?? process.env.GMAIL_USER ?? 'admin@example.com';
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
  configured = true;
  return true;
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
  if (!configure()) {
    await logNotification({
      channel: 'push',
      target: 'admins',
      status: 'failed',
      error: 'VAPID keys not configured',
      payload,
    });
    return { sent: 0, failed: 0 };
  }

  const supabase = createAdminClient();

  const { data: allowlist } = await supabase
    .from('admin_allowlist')
    .select('email')
    .is('revoked_at', null)
    .eq('notify_push', true);

  const emails = (allowlist ?? []).map((row) => (row.email as string).toLowerCase());
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const { data: profiles } = await supabase.from('admin_profiles').select('user_id, email');

  const userIds = (profiles ?? [])
    .filter((profile) => emails.includes((profile.email as string).toLowerCase()))
    .map((profile) => profile.user_id as string);

  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

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
          { TTL: 60 * 60 },
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
          error: String((error as Error).message ?? error),
          payload,
        });
      }
    }),
  );

  return { sent, failed };
}
