import 'server-only';

import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import { logNotification } from '@/lib/notifications/log';
import { t } from '@/lib/i18n';
import { formatDateLong, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import { absoluteUrl, formatIsraeliPhone } from '@/lib/utils';
import type { BookingRequestRow } from '@/lib/types';

let resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (resend !== undefined) return resend;
  const key = process.env.RESEND_API_KEY;
  resend = key ? new Resend(key) : null;
  return resend;
}

/**
 * §9.1 step 2: Hebrew RTL HTML template with the request details and two
 * buttons. Email clients ignore most CSS, so `dir="rtl"` is set on the elements
 * themselves and the layout is tables-free but inline-styled — this renders in
 * Gmail, iOS Mail and Outlook without a preprocessor.
 */
function renderNewRequestEmail(request: BookingRequestRow): { subject: string; html: string } {
  const day = formatWeekdayLong(localDate(request.requested_start));
  const date = formatDateLong(localDate(request.requested_start));
  const range = formatTimeRange(request.requested_start, request.requested_end);
  const dashboardUrl = absoluteUrl(`/admin?request=${request.id}`);

  const subject = `${t('admin.pending')}: ${request.requester_name} · ${day} ${range}`;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:24px;background:#F2F5F0;font-family:Assistant,Arial,sans-serif;color:#0E2A20;" dir="rtl">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DED3;">
      <div style="background:#174634;color:#F2F5F0;padding:20px 24px;">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(t('app.name'))}</div>
        <div style="font-size:14px;opacity:.85;margin-top:4px;">בקשה חדשה במגרש</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.65;">
          <strong>${escapeHtml(request.requester_name)}</strong> ביקש/ה את המגרש.
        </p>
        <dl style="margin:0 0 24px;font-size:15px;line-height:1.8;">
          ${row('מועד', `${escapeHtml(day)}, ${escapeHtml(date)}`)}
          ${row('שעות', `<span dir="ltr">${escapeHtml(range)}</span>`)}
          ${row('סוג שימוש', escapeHtml(usageTypeLabel(request.usage_type)))}
          ${request.participants ? row('משתתפים', String(request.participants)) : ''}
          ${row('טלפון', `<span dir="ltr">${escapeHtml(formatIsraeliPhone(request.requester_phone))}</span>`)}
          ${request.note ? row('הערה', escapeHtml(request.note)) : ''}
        </dl>
        <a href="${dashboardUrl}" style="display:inline-block;background:#F2B441;color:#0E2A20;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;font-size:16px;">
          פתיחת הבקשה בלוח הבקרה
        </a>
        <a href="tel:${escapeHtml(request.requester_phone)}" style="display:inline-block;margin-inline-start:8px;background:#F2F5F0;color:#0E2A20;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:8px;font-size:16px;border:1px solid #D6DED3;">
          ${escapeHtml(t('trustees.call'))}
        </a>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

function row(label: string, value: string): string {
  return `<div style="display:flex;gap:8px;"><dt style="min-width:96px;color:#7A8A82;">${escapeHtml(label)}</dt><dd style="margin:0;font-weight:600;">${value}</dd></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function emailAdminsNewRequest(request: BookingRequestRow): Promise<number> {
  const client = getResend();
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!client || !from) {
    await logNotification({
      channel: 'email',
      target: 'admins',
      status: 'failed',
      error: 'RESEND_API_KEY or NOTIFY_FROM_EMAIL not configured',
    });
    return 0;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('admin_allowlist')
    .select('email')
    .is('revoked_at', null)
    .eq('notify_email', true);

  const recipients = (data ?? []).map((r) => r.email as string);
  if (recipients.length === 0) return 0;

  const { subject, html } = renderNewRequestEmail(request);
  let sent = 0;

  // Sent individually rather than as one message with many recipients: admins
  // should not see each other's addresses, and one bad address should not fail
  // the whole batch.
  await Promise.all(
    recipients.map(async (to) => {
      try {
        const result = await client.emails.send({ from, to, subject, html });
        if (result.error) throw new Error(result.error.message);
        sent += 1;
        await logNotification({ channel: 'email', target: to, subject, status: 'sent' });
      } catch (error) {
        reportError(error, { where: 'emailAdminsNewRequest', to });
        await logNotification({
          channel: 'email',
          target: to,
          subject,
          status: 'failed',
          error: String((error as Error).message ?? error),
        });
      }
    }),
  );

  return sent;
}
