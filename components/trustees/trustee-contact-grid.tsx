'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn, initials, telLink, whatsappLink, formatIsraeliPhone } from '@/lib/utils';
import { Ltr } from '@/components/ui/ltr';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { TrusteeRow } from '@/lib/types';

/**
 * The on-duty box used to single out one trustee; the site no longer tracks
 * who that is, so the contact page instead offers every trustee as an equal
 * tap target. Each circle opens a small sheet with the two ways to reach
 * them — tapping a name is not itself an action, since it is ambiguous
 * whether it should call or open WhatsApp.
 */
export function TrusteeContactGrid({ trustees }: { trustees: TrusteeRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = trustees.find((trustee) => trustee.id === selectedId) ?? null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {trustees.map((trustee) => {
          const muted = !trustee.is_available;
          return (
            <li key={trustee.id}>
              <button
                type="button"
                disabled={muted}
                onClick={() => setSelectedId(trustee.id)}
                className={cn(
                  'press flex w-full flex-col items-center gap-2 rounded-(--radius-input) p-2 text-center',
                  'transition-[background-color,transform] duration-(--duration-press) ease-(--ease-out-quiet)',
                  muted ? 'pointer-events-none opacity-50' : 'hover:bg-(--surface-sunken)',
                )}
              >
                {trustee.photo_url ? (
                  <Image
                    src={trustee.photo_url}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 shrink-0 rounded-full object-cover ring-4 ring-(--surface-sunken)"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-50 font-display text-h3 font-bold text-primary-700 ring-4 ring-(--surface-sunken)"
                  >
                    {initials(trustee.full_name)}
                  </span>
                )}
                <span className="line-clamp-2 text-sm font-semibold">{trustee.full_name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected ? (
          <SheetContent title={selected.full_name} description={selected.title ?? undefined}>
            <div className="flex flex-col gap-3">
              {selected.whatsapp_ok ? (
                <a
                  href={whatsappLink(selected.phone_e164, t('trustees.whatsapp_prefill'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'press inline-flex min-h-14 items-center justify-center gap-3 rounded-(--radius-input)',
                    'bg-[#25D366] px-7 text-base font-semibold text-[#0b3b21] shadow-(--shadow-md)',
                    // `translate` alongside `transform`: `.press`'s active-scale
                    // is a literal `transform`, but Tailwind v4 compiles the
                    // hover-lift (`-translate-y-px`) to the separate `translate`
                    // property — without it here that lift snaps, not eases.
                    'transition-[background-color,box-shadow,transform,translate] duration-(--duration-press)',
                    'ease-(--ease-out-quiet) motion-safe:hover:-translate-y-px hover:bg-[#20bd5a]',
                  )}
                >
                  <MessageCircle className="size-6" aria-hidden />
                  {t('contact.whatsapp_cta')}
                </a>
              ) : null}

              <a
                href={telLink(selected.phone_e164)}
                className={cn(
                  'press inline-flex min-h-14 items-center justify-center gap-3 rounded-(--radius-input)',
                  'border border-(--hairline) bg-(--surface-raised) px-7 text-base font-semibold text-(--ink)',
                  // `translate` alongside `transform`: see the WhatsApp button above.
                  'shadow-(--shadow-xs) transition-[background-color,border-color,box-shadow,transform,translate]',
                  'duration-(--duration-press) ease-(--ease-out-quiet)',
                  'motion-safe:hover:-translate-y-px hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
                )}
              >
                <Phone className="size-6" aria-hidden />
                {t('contact.call_cta')}
              </a>

              <p className="flex items-center justify-center gap-2 text-sm text-(--ink-muted)">
                <Ltr>{formatIsraeliPhone(selected.phone_e164)}</Ltr>
              </p>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </>
  );
}
