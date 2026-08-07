import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';

export type NotificationChannel = 'email' | 'push' | 'whatsapp';

/**
 * §9.3: every attempt is written to `notification_log`. The dashboard shows an
 * unread badge regardless of delivery, so a failed notification degrades to a
 * slower response, never to a lost request.
 */
export async function logNotification(entry: {
  channel: NotificationChannel;
  target: string;
  subject?: string;
  payload?: unknown;
  status: 'sent' | 'failed';
  error?: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('notification_log').insert({
      channel: entry.channel,
      target: entry.target,
      subject: entry.subject ?? null,
      payload: entry.payload ?? null,
      status: entry.status,
      error: entry.error ?? null,
    });
  } catch (error) {
    // Logging the log failure and moving on; this must never throw into the
    // fan-out and abort the remaining channels.
    reportError(error, { where: 'logNotification' });
  }
}
