import Image from 'next/image';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn, initials, telLink, whatsappLink } from '@/lib/utils';
import type { TrusteeRow } from '@/lib/types';

/**
 * §10.5 team card. Each carries two LARGE tap targets — call and WhatsApp —
 * because the realistic use is one-handed, at the gate, wanting a person rather
 * than a page.
 *
 * FR-30: an unavailable trustee is visually muted and their actions disabled,
 * rather than being removed. Someone looking for a specific person should find
 * out that they are away, not that they have vanished.
 */
export function TrusteeCard({ trustee }: { trustee: TrusteeRow }) {
  const muted = !trustee.is_available;

  return (
    <li
      className={cn(
        // `min-w-0`: a grid item defaults to `min-width: auto`, so without it
        // the card refuses to shrink below the intrinsic width of the two
        // action buttons below and spills out of its own column.
        'card relative flex min-w-0 flex-col p-6 text-center',
        // Muted, not removed. The saturation drop does more of the work than
        // opacity alone, which on a white card just looks like a render glitch.
        muted && 'opacity-75 saturate-50',
      )}
    >
      {trustee.photo_url ? (
        <Image
          src={trustee.photo_url}
          alt=""
          width={88}
          height={88}
          className="mx-auto size-22 shrink-0 rounded-full object-cover ring-4 ring-(--surface-sunken)"
        />
      ) : (
        <span
          aria-hidden
          className="mx-auto flex size-22 shrink-0 items-center justify-center rounded-full bg-primary-50 font-display text-h2 font-bold text-primary-700 ring-4 ring-(--surface-sunken)"
        >
          {initials(trustee.full_name)}
        </span>
      )}

      <p className="mt-4 text-h3 font-bold">{trustee.full_name}</p>

      {muted ? (
        <p className="mt-2 text-sm font-semibold text-danger-ink">{t('trustees.unavailable')}</p>
      ) : null}

      {/* Call and WhatsApp sit side by side whenever they fit and stack when
          they do not — two full-width targets on a narrow phone read better
          than two cramped half-width ones, and it is what keeps the card
          inside its column at the largest accessibility font scale. */}
      <div className="mt-5 flex flex-wrap gap-2 pt-1">
        <Action
          href={telLink(trustee.phone_e164)}
          disabled={muted}
          label={t('trustees.call')}
          name={trustee.full_name}
        >
          <Phone className="size-5 text-[#2563eb]" aria-hidden />
        </Action>

        {trustee.whatsapp_ok ? (
          <Action
            href={whatsappLink(trustee.phone_e164, t('trustees.whatsapp_prefill'))}
            disabled={muted}
            label={t('trustees.whatsapp')}
            name={trustee.full_name}
            external
          >
            <MessageCircle className="size-5 text-[#25D366]" aria-hidden />
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
    // `basis-28` is the wrap threshold rather than a fixed width: the pair
    // shares one row while each half can hold ~7rem, and drops to a stack
    // below that instead of overflowing the card.
    'press tap-target flex min-w-0 flex-1 basis-28 items-center justify-center gap-2 rounded-(--radius-input)',
    'border border-(--hairline) bg-(--surface-raised) px-3 text-sm font-semibold sm:px-4',
    'transition-[background-color,border-color,color,transform] duration-(--duration-press)',
    'ease-(--ease-out-quiet)',
    disabled
      ? 'pointer-events-none opacity-50'
      : 'hover:border-primary/40 hover:bg-primary-50 hover:text-primary-700',
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
      aria-label={`${label} - ${name}`}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {label}
    </a>
  );
}
