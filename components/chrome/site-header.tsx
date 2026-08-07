import Link from 'next/link';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import { telLink, whatsappLink, cn } from '@/lib/utils';
import type { TrusteeRow } from '@/lib/types';

/**
 * §10.1 header: pitch name, a small memorial mark, and the "on duty" trustee
 * chip with call/WhatsApp icons.
 *
 * FR-39: the memorial mark links to /memorial from every screen. It is
 * deliberately discreet — a thin cool-grey rule and a word, not a badge. The
 * memorial tone (--color-memorial) is the only place this colour is allowed.
 */
export function SiteHeader({
  pitchName,
  onDuty,
}: {
  pitchName: string;
  onDuty?: TrusteeRow | null;
}) {
  return (
    <header className="bg-pitch-700 text-chalk-050">
      <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link href="/" className="block rounded-[--radius-input]">
            <span className="block truncate font-display text-h3 font-bold leading-tight">
              {pitchName}
            </span>
          </Link>
          <Link
            href="/memorial"
            className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-memorial hover:text-chalk-200"
          >
            <span aria-hidden className="inline-block h-px w-4 bg-memorial" />
            {t('memorial.title')}
          </Link>
        </div>

        {onDuty ? <OnDutyChip trustee={onDuty} /> : null}
      </div>
    </header>
  );
}

/** FR-29: the primary trustee appears as the "on duty" contact on the schedule. */
function OnDutyChip({ trustee }: { trustee: TrusteeRow }) {
  const actionClass = cn(
    'tap-target flex items-center justify-center rounded-[--radius-input]',
    'bg-chalk-050/10 text-chalk-050 hover:bg-chalk-050/20',
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden text-end sm:block">
        <div className="text-xs text-chalk-200">{t('trustees.on_duty')}</div>
        <div className="text-sm font-semibold">{trustee.full_name}</div>
      </div>

      <a
        href={telLink(trustee.phone_e164)}
        className={actionClass}
        aria-label={`${t('trustees.call')} — ${trustee.full_name}`}
      >
        {/* A phone icon does not imply direction, so it must NOT mirror (§11.4). */}
        <Phone className="size-5" aria-hidden />
      </a>

      {trustee.whatsapp_ok ? (
        <a
          href={whatsappLink(trustee.phone_e164, t('trustees.whatsapp_prefill'))}
          className={actionClass}
          aria-label={`${t('trustees.whatsapp')} — ${trustee.full_name}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
