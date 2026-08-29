import 'server-only';

import { after } from 'next/server';
import { t } from '@/lib/i18n';
import { formatDateShort, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { reportError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushToAdmins } from '@/lib/notifications/push';
import { emailAdminsNewRequest } from '@/lib/notifications/email';
import type { BookingRequestRow } from '@/lib/types';

/**
 * FR-19 / §9.1: on submission ALL admins are notified. Web push is awaited by
 * the request route so a serverless invocation cannot finish before the push
 * provider has accepted (or rejected) the message. SMTP remains in `after()`:
 * it is slower and must not hold the visitor on the success screen.
 */
export async function notifyAdminsOfNewRequest(request: BookingRequestRow): Promise<void> {
  const day = formatWeekdayLong(localDate(request.requested_start));
  const date = formatDateShort(localDate(request.requested_start));
  const range = formatTimeRange(request.requested_start, request.requested_end);

  const payload = {
    title: t('app.name') + ' - בקשה חדשה',
    body: `${request.requester_name} · ${day} ${date} · ${range}`,
    url: `/admin?request=${request.id}`,
    tag: `request-${request.id}`,
    requestId: request.id,
    // The whole queue, not "+1": two requests arriving close together must
    // not race to both claim they are the first, and an admin who already
    // cleared some elsewhere should see what is actually left.
    badgeCount: await countPendingRequests(),
  };

  const email = async () => {
    try {
      await emailAdminsNewRequest(request);
    } catch (error) {
      reportError(error, { where: 'notifyAdminsOfNewRequest.email', requestId: request.id });
    }
  };

  // `after()` throws SYNCHRONOUSLY — not a rejected promise — when `waitUntil`
  // isn't available in the current runtime (a plain `next start`/self-host
  // without the Vercel adapter, some local dev setups). That would take the
  // whole booking submission down with it, which is a far worse outcome than
  // a best-effort notification: the visitor's booking is the point, the
  // email is a courtesy. Falling back to firing it unawaited keeps the
  // request bulletproof either way, at the cost of no delivery guarantee if
  // this specific runtime kills the process before it finishes.
  try {
    after(email);
  } catch (error) {
    reportError(error, { where: 'notifyAdminsOfNewRequest.after', requestId: request.id });
    void email();
  }

  // `pushToAdmins` records ordinary provider, configuration, query, and empty
  // recipient failures. This last catch protects the booking if an unexpected
  // error escapes that boundary.
  try {
    await pushToAdmins(payload);
  } catch (error) {
    reportError(error, { where: 'notifyAdminsOfNewRequest.push', requestId: request.id });
  }
}

/**
 * How many requests are waiting on a decision — the number the app icon badge
 * shows. Counted with `head: true` so Postgres returns the count and no rows.
 *
 * Read with the service role because the visitor who just submitted is
 * anonymous — there is no admin session here for RLS to resolve.
 *
 * Falls back to `undefined` rather than 0 on failure. A zero would tell every
 * admin's phone to CLEAR its badge (§ lib/app-badge.ts), quietly hiding a queue
 * that is not empty; `undefined` leaves whatever the badge already said.
 */
async function countPendingRequests(): Promise<number | undefined> {
  try {
    const { count, error } = await createAdminClient()
      .from('booking_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;
    return count ?? undefined;
  } catch (error) {
    reportError(error, { where: 'countPendingRequests' });
    return undefined;
  }
}
