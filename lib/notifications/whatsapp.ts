import { t } from '@/lib/i18n';
import { formatDateLong, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { absoluteUrl, whatsappLink } from '@/lib/utils';
import type { PublicRequestView, RequestStatus } from '@/lib/types';

/**
 * §9.2 / FR-24. The v1 default is a one-tap manual WhatsApp link that the
 * acting admin sends, plus the status page — no messaging provider is paid for
 * (open decision #2). This module builds the message; nothing here sends it.
 *
 * If a provider is approved later, add a `sendSms()` adapter behind an
 * interface and call it alongside this — the message text is already shared.
 */
const STATUS_SENTENCE: Record<RequestStatus, string> = {
  pending: 'הבקשה שלך התקבלה וממתינה לאישור.',
  approved: 'הבקשה שלך למגרש גלעד אושרה.',
  approved_modified: 'הבקשה שלך למגרש גלעד אושרה, בשינוי שעה.',
  rejected: 'הבקשה שלך למגרש גלעד נדחתה.',
  cancelled: 'הבקשה שלך למגרש גלעד בוטלה.',
  expired: 'הבקשה שלך למגרש גלעד פגה מבלי שטופלה.',
};

export function decisionMessage(request: PublicRequestView, token: string): string {
  const start = request.finalStart ?? request.requestedStart;
  const end = request.finalEnd ?? request.requestedEnd;
  const day = formatWeekdayLong(localDate(start));
  const date = formatDateLong(localDate(start));

  const lines = [
    `שלום ${request.requesterName},`,
    STATUS_SENTENCE[request.status],
  ];

  if (request.status === 'approved' || request.status === 'approved_modified') {
    lines.push(`המועד: ${day}, ${date}, ${formatTimeRange(start, end)}`);
  }

  if (request.decisionNote) {
    lines.push(`הערה: ${request.decisionNote}`);
  }

  lines.push('', `פרטים ומעקב: ${absoluteUrl(`/request/${token}`)}`);

  return lines.join('\n');
}

export function decisionWhatsappLink(
  phoneE164: string,
  request: PublicRequestView,
  token: string,
): string {
  return whatsappLink(phoneE164, decisionMessage(request, token));
}

/** FR-16: "send the status link to myself" on the success screen. */
export function saveLinkToSelfMessage(statusUrl: string): string {
  return `${t('app.name')} — ${t('request.success.link_title')}:\n${statusUrl}`;
}

export function saveLinkToSelfHref(statusUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(saveLinkToSelfMessage(statusUrl))}`;
}
