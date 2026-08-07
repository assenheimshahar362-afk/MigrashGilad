'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, MessageCircle, PartyPopper } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateLong, formatWeekdayLong, timeFromMinutes, minutesFromTime } from '@/lib/time';
import { saveLinkToSelfHref } from '@/lib/notifications/whatsapp';
import { Button } from '@/components/ui/button';
import { TimeRange } from '@/components/ui/ltr';

/**
 * §10.3 success screen. FR-16: the visitor receives the status link on screen
 * and as a WhatsApp "send to myself" link.
 *
 * §2 visitor rules: there is no account, so this link is the ONLY continuity the
 * visitor has. Losing it is recoverable only by phoning a trustee — which is
 * why the copy insists on saving it rather than mentioning it in passing.
 */
export function SuccessPanel({
  statusUrl,
  date,
  startTime,
  endTime,
}: {
  statusUrl: string;
  date: string;
  startTime: string;
  endTime: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(statusUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked in some in-app browsers; the input below is
      // selectable, so there is still a way through.
    }
  };

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="text-center">
        <PartyPopper className="mx-auto size-10 text-floodlight" aria-hidden />
        <h2 className="mt-2 text-h1">{t('request.success.title')}</h2>
        <p className="mt-2 text-[--ink-muted]">{t('request.success.body')}</p>
      </div>

      <section className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h3 className="text-sm font-semibold text-[--ink-muted]">{t('request.success.slot')}</h3>
        <p className="mt-1 font-semibold">
          {formatWeekdayLong(date)}, {formatDateLong(date)}
        </p>
        <TimeRange
          range={`${timeFromMinutes(minutesFromTime(startTime))}–${timeFromMinutes(minutesFromTime(endTime))}`}
          className="mt-1 block text-h3"
        />
      </section>

      <section className="rounded-[--radius-card] border-2 border-floodlight bg-floodlight/10 p-4">
        <h3 className="font-bold">{t('request.success.link_title')}</h3>
        <p className="mt-1 text-sm">{t('request.success.link_help')}</p>

        <input
          readOnly
          value={statusUrl}
          dir="ltr"
          aria-label={t('request.success.link_title')}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 min-h-11 w-full rounded-[--radius-input] border border-[--hairline] bg-[--surface-raised] px-3 text-sm"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
            {copied ? t('request.success.copied') : t('request.success.copy')}
          </Button>

          <Button asChild variant="secondary">
            <a href={saveLinkToSelfHref(statusUrl)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" aria-hidden />
              {t('request.success.save_link')}
            </a>
          </Button>
        </div>
      </section>

      <section>
        <h3 className="font-bold">{t('request.success.what_now')}</h3>
        <p className="mt-1 text-sm text-[--ink-muted]">{t('request.success.body')}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link href={new URL(statusUrl).pathname}>{t('request.success.open_status')}</Link>
        </Button>
        <Button asChild variant="quiet">
          <Link href="/">{t('common.back_home')}</Link>
        </Button>
      </div>
    </div>
  );
}
