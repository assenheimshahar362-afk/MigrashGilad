import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import { logNotification } from '@/lib/notifications/log';
import { t } from '@/lib/i18n';
import { formatDateLong, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import { absoluteUrl, formatIsraeliPhone } from '@/lib/utils';
import type { AccessRequestRow, AdminRole, BookingRequestRow } from '@/lib/types';

/**
 * Sent through the sender's own Gmail account over SMTP, not a transactional
 * email API — no domain to verify, no DNS records, just an address and an app
 * password. The trade-off is Gmail's own sending caps (500/day on a personal
 * account), which a community pitch's notification volume never gets near.
 *
 * `GMAIL_APP_PASSWORD` is an app password (myaccount.google.com/apppasswords),
 * not the account's real password — it requires 2-Step Verification to be
 * turned on first, and it is the only credential this ever holds.
 */
let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  transporter =
    user && pass
      ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
      : null;
  return transporter;
}

/** The header the recipient sees. A display name if the account carries one,
 *  the Gmail address on its own otherwise — Gmail rejects a From address that
 *  isn't the authenticated account (or a configured alias of it), so there is
 *  no separate "from" setting to get out of sync with `GMAIL_USER`. */
function fromAddress(): string {
  const user = process.env.GMAIL_USER ?? '';
  const name = process.env.NOTIFY_FROM_NAME;
  return name ? `${name} <${user}>` : user;
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
  <body style="margin:0;padding:24px;background:#F2F5F0;font-family:Assistant,Arial,sans-serif;color:#12253C;" dir="rtl">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DED3;">
      <div style="background:#122540;color:#F2F5F0;padding:20px 24px;">
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
        <a href="${dashboardUrl}" style="display:inline-block;background:#D63B2B;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;font-size:16px;">
          פתיחת הבקשה בלוח הבקרה
        </a>
        <a href="tel:${escapeHtml(request.requester_phone)}" style="display:inline-block;margin-inline-start:8px;background:#F2F5F0;color:#12253C;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:8px;font-size:16px;border:1px solid #D6DED3;">
          ${escapeHtml(t('trustees.call'))}
        </a>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

/**
 * §2: a person asked for access. The mail carries no approve link and no token
 * — approving grants admin rights, so it happens signed in, in /admin/access,
 * and never from whoever is holding this inbox message.
 */
function renderAccessRequestEmail(request: AccessRequestRow): { subject: string; html: string } {
  const queueUrl = absoluteUrl('/admin/access');
  const who = request.full_name ?? request.email;
  const subject = `${t('access.email_subject')}: ${who}`;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:24px;background:#F2F5F0;font-family:Assistant,Arial,sans-serif;color:#12253C;" dir="rtl">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DED3;">
      <div style="background:#122540;color:#F2F5F0;padding:20px 24px;">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(t('app.name'))}</div>
        <div style="font-size:14px;opacity:.85;margin-top:4px;">${escapeHtml(t('access.email_title'))}</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.65;">
          ${escapeHtml(t('access.email_body'))}
        </p>
        <dl style="margin:0 0 24px;font-size:15px;line-height:1.8;">
          ${row('שם', escapeHtml(request.full_name ?? '—'))}
          ${row('דוא״ל', `<span dir="ltr">${escapeHtml(request.email)}</span>`)}
          ${row('אמצעי כניסה', escapeHtml(request.provider === 'google' ? 'Google' : 'דוא״ל וסיסמה'))}
        </dl>
        <a href="${queueUrl}" style="display:inline-block;background:#D63B2B;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;font-size:16px;">
          ${escapeHtml(t('access.email_cta'))}
        </a>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#7A8A82;">
          ${escapeHtml(t('access.email_footer'))}
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

/**
 * §2: sent to the APPLICANT, once, the moment a super admin approves their
 * access request — the mirror of `renderAccessRequestEmail` above, which told
 * the super admin one existed. Unlike that one, this carries a real CTA: the
 * person can act on it themselves now, because approving is what makes them
 * allowed to.
 */
function renderAccessApprovedEmail(
  request: AccessRequestRow,
  role: AdminRole,
): { subject: string; html: string } {
  const loginUrl = absoluteUrl('/login');
  const subject = t('access.approved_email_subject');

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:24px;background:#F2F5F0;font-family:Assistant,Arial,sans-serif;color:#12253C;" dir="rtl">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DED3;">
      <div style="background:#122540;color:#F2F5F0;padding:20px 24px;">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(t('app.name'))}</div>
        <div style="font-size:14px;opacity:.85;margin-top:4px;">${escapeHtml(t('access.approved_email_title'))}</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.65;">
          ${escapeHtml(t('access.approved_email_body'))}
        </p>
        <dl style="margin:0 0 24px;font-size:15px;line-height:1.8;">
          ${row('דוא״ל', `<span dir="ltr">${escapeHtml(request.email)}</span>`)}
          ${row('הרשאה', escapeHtml(t(`managers.role.${role}` as const)))}
        </dl>
        <a href="${loginUrl}" style="display:inline-block;background:#D63B2B;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;font-size:16px;">
          ${escapeHtml(t('access.approved_email_cta'))}
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

/**
 * Send one rendered message to one address, logging the attempt either way
 * (§9.3). Shared by `sendToAdmins`'s fan-out and by a single-recipient send
 * like `emailAccessApproved` — the failure handling (log, report, move on)
 * has to be identical either way, or a silent Gmail outage would only show up
 * in one of the two paths.
 */
async function sendOne(
  to: string,
  { subject, html }: { subject: string; html: string },
  where: string,
): Promise<boolean> {
  const client = getTransport();

  if (!client) {
    await logNotification({
      channel: 'email',
      target: to,
      subject,
      status: 'failed',
      error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured',
    });
    return false;
  }

  try {
    await client.sendMail({ from: fromAddress(), to, subject, html });
    await logNotification({ channel: 'email', target: to, subject, status: 'sent' });
    return true;
  } catch (error) {
    reportError(error, { where, to });
    await logNotification({
      channel: 'email',
      target: to,
      subject,
      status: 'failed',
      error: String((error as Error).message ?? error),
    });
    return false;
  }
}

/**
 * Send one rendered message to a set of admins.
 *
 * Sent individually rather than as one message with many recipients: admins
 * should not see each other's addresses, and one bad address should not fail
 * the whole batch.
 */
async function sendToAdmins(
  message: { subject: string; html: string },
  { superOnly = false, where }: { superOnly?: boolean; where: string },
): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from('admin_allowlist')
    .select('email')
    .is('revoked_at', null)
    .eq('notify_email', true);

  if (superOnly) query = query.eq('role', 'super_admin');

  const { data } = await query;
  const recipients = (data ?? []).map((r) => r.email as string);
  if (recipients.length === 0) return 0;

  const results = await Promise.all(recipients.map((to) => sendOne(to, message, where)));
  return results.filter(Boolean).length;
}

export async function emailAdminsNewRequest(request: BookingRequestRow): Promise<number> {
  return sendToAdmins(renderNewRequestEmail(request), { where: 'emailAdminsNewRequest' });
}

/**
 * §2: only a super admin can decide an access request, so only a super admin is
 * told about one. Sending it to every admin would be a notification nobody
 * receiving it could act on.
 */
export async function emailAdminsAccessRequest(request: AccessRequestRow): Promise<number> {
  return sendToAdmins(renderAccessRequestEmail(request), {
    superOnly: true,
    where: 'emailAdminsAccessRequest',
  });
}

/**
 * The applicant's own notification, sent once `decide_access_request()` has
 * committed the approval — never speculatively, and never for a rejection
 * (§2: a refusal is not announced by mail; the person is simply not on the
 * allowlist).
 */
export async function emailAccessApproved(request: AccessRequestRow, role: AdminRole): Promise<boolean> {
  return sendOne(request.email, renderAccessApprovedEmail(request, role), 'emailAccessApproved');
}
