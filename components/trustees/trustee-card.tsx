import Image from 'next/image';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn, initials, telLink, whatsappLink } from '@/lib/utils';
import type { TrusteeRow } from '@/lib/types';

/**
 * §10.5. Each card carries two LARGE tap targets — call and WhatsApp — because
 * the realistic use is one-handed, at the gate, wanting a person rather than a
 * page.
 *
 * FR-30: an unavailable trustee is visually muted and their actions are
 * disabled, rather than being removed. Someone looking for a specific person
 * should find out that they are away, not that they have vanished.
 */
export function TrusteeCard({ trustee, isOnDuty }: { trustee: TrusteeRow; isOnDuty: boolean }) {
  const muted = !trustee.is_available;

  return (
    <li
      className={cn(
        'rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4',
        muted && 'opacity-60',
      )}
    >
      {isOnDuty ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-normal text-floodlight">
          {t('trustees.on_duty')}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {trustee.photo_url ? (
          <Image
            src={trustee.photo_url}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pitch-700 text-lg font-bold text-chalk-050"
          >
            {initials(trustee.full_name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{trustee.full_name}</p>
          {trustee.title ? (
            <p className="truncate text-sm text-[--ink-muted]">{trustee.title}</p>
          ) : null}
          {muted ? (
            <p className="text-sm font-semibold text-signal-err">{t('trustees.unavailable')}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Action
          href={telLink(trustee.phone_e164)}
          disabled={muted}
          label={t('trustees.call')}
          name={trustee.full_name}
        >
          <Phone className="size-5" aria-hidden />
        </Action>

        {trustee.whatsapp_ok ? (
          <Action
            href={whatsappLink(trustee.phone_e164, t('trustees.whatsapp_prefill'))}
            disabled={muted}
            label={t('trustees.whatsapp')}
            name={trustee.full_name}
            external
          >
            <MessageCircle className="size-5" aria-hidden />
          </Action>
        ) : null}
      </div>
    </li>
  );
}

function Action({
  href,
  disabled,
  label,
  name,
  external,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  name: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'tap-target flex flex-1 items-center justify-center gap-2 rounded-[--radius-input]',
    'border border-[--hairline] px-4 font-semibold',
    disabled ? 'pointer-events-none opacity-50' : 'hover:bg-[--surface-sunken]',
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={className}
      aria-label={`${label} — ${name}`}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {label}
    </a>
  );
}
