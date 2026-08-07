import 'server-only';

import { after } from 'next/server';
import { t } from '@/lib/i18n';
import { formatDateShort, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { reportError } from '@/lib/errors';
import { pushToAdmins } from '@/lib/notifications/push';
import { emailAdminsNewRequest } from '@/lib/notifications/email';
import type { BookingRequestRow } from '@/lib/types';

/**
 * FR-19 / §9.1: on submission ALL admins are notified. The fan-out runs after
 * the response has been returned (`after()`, Vercel's waitUntil), so submission
 * latency is unaffected — G2 wants the visitor done in 60 seconds, and waiting
 * on an SMTP round trip would be a needless part of that budget.
 */
export function notifyAdminsOfNewRequest(request: BookingRequestRow): void {
  after(async () => {
    const day = formatWeekdayLong(localDate(request.requested_start));
    const date = formatDateShort(localDate(request.requested_start));
    const range = formatTimeRange(request.requested_start, request.requested_end);

    const payload = {
      title: t('app.name') + ' — בקשה חדשה',
      body: `${request.requester_name} · ${day} ${date} · ${range}`,
      url: `/admin?request=${request.id}`,
      tag: `request-${request.id}`,
      requestId: request.id,
    };

    // Channels are independent: a failing Resend key must not stop web push.
    const results = await Promise.allSettled([
      pushToAdmins(payload),
      emailAdminsNewRequest(request),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        reportError(result.reason, { where: 'notifyAdminsOfNewRequest', requestId: request.id });
      }
    }
  });
}
