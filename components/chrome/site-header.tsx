'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import { telLink, whatsappLink, cn } from '@/lib/utils';
import type { TrusteeRow } from '@/lib/types';

/**
 * Global header.
 *
 * On a page with a hero the bar starts transparent and sits over the image;
 * past 24px of scroll it becomes the frosted white bar. The threshold is small
 * on purpose — the swap should happen as soon as the hero starts to leave, not
 * halfway down it, or the bar spends a long stretch unreadable over content.
 *
 * FR-39: the memorial mark links to /memorial from every screen. It is
 * deliberately discreet — a thin rule and a word, not a badge — and it is the
 * only place the memorial tone is allowed in the chrome.
 */
const LINKS = [
  { href: '/', label: t('nav.schedule'), exact: true },
  { href: '/request', label: t('nav.request'), exact: false },
  { href: '/about', label: t('nav.about'), exact: false },
  { href: '/gallery', label: t('nav.gallery'), exact: false },
  { href: '/trustees', label: t('nav.trustees'), exact: false },
  { href: '/faq', label: t('nav.faq'), exact: false },
  { href: '/contact', label: t('nav.contact'), exact: false },
] as const;

/** The routes whose first element is a full-bleed hero, so the bar has to start
 *  transparent and sit over it. */
const HERO_ROUTES = new Set<string>(['/']);

export function SiteHeader({
  pitchName,
  onDuty,
}: {
  pitchName: string;
  onDuty?: TrusteeRow | null;
}) {
  const pathname = usePathname();
  const overHero = HERO_ROUTES.has(pathname);
  const [solid, setSolid] = useState(!overHero);

  useEffect(() => {
    if (!overHero) {
      setSolid(true);
      return;
    }
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  return (
    <header
      data-solid={solid ? 'true' : 'false'}
      className={cn(
        'z-40',
        // `sticky` reserves space in the flow, which is right on a normal page
        // and wrong over a hero — there the bar has to float on top of the
        // image, so it leaves the flow entirely.
        overHero ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        // Only these properties transition. Animating `backdrop-filter` itself
        // is expensive and visibly stutters on iOS, so the blur is constant and
        // only the tint and the rule change.
        'transition-[background-color,border-color,box-shadow] duration-300 ease-(--ease-out-quiet)',
        'motion-reduce:transition-none',
        solid
          ? 'chrome-blur border-b border-(--hairline) shadow-(--shadow-xs)'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="shell flex items-center gap-4 py-3 sm:py-4">
        <Link
          href="/"
          className="press-sm min-w-0 shrink-0 rounded-(--radius-input) py-0.5"
          aria-label={pitchName}
        >
          <span
            className={cn(
              'block truncate font-display text-h3 leading-tight font-bold transition-colors duration-300',
              solid ? 'text-(--ink)' : 'text-white drop-shadow-sm',
            )}
          >
            {pitchName}
          </span>
          <span
            className={cn(
              'mt-0.5 flex items-center gap-1.5 text-xs transition-colors duration-300',
              solid ? 'text-(--ink-faint)' : 'text-white/75',
            )}
          >
            <span aria-hidden className="inline-block h-px w-3.5 bg-current" />
            {t('app.tagline')}
          </span>
        </Link>

        {/* Desktop navigation. The bottom tab bar covers mobile, so this is
            simply hidden below lg rather than duplicated into a hamburger. */}
        <nav aria-label={t('nav.primary')} className="ms-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'press flex h-10 items-center rounded-(--radius-input) px-3 text-sm font-medium',
                      'transition-[background-color,color] duration-(--duration-tip) ease-(--ease-out-quiet)',
                      solid
                        ? active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-(--ink-muted) hover:bg-(--surface-sunken) hover:text-(--ink)'
                        : active
                          ? 'bg-white/20 text-white'
                          : 'text-white/85 hover:bg-white/12 hover:text-white',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
          {onDuty ? <OnDutyChip trustee={onDuty} solid={solid} /> : null}

          <Link
            href="/memorial"
            className={cn(
              'group hidden min-h-7 items-center gap-1.5 rounded-(--radius-chip) px-2.5 py-1 text-xs sm:inline-flex',
              'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
              solid
                ? 'text-memorial-ink hover:bg-(--surface-sunken)'
                : 'text-white/75 hover:bg-white/12 hover:text-white',
            )}
          >
            {/* The rule lengthens on hover — the quietest way for a deliberately
                unemphatic link to acknowledge the pointer. */}
            <span
              aria-hidden
              className={cn(
                'inline-block h-px w-3.5 bg-current',
                'transition-[width] duration-200 ease-(--ease-out-quiet)',
                'group-hover:w-6',
              )}
            />
            {t('memorial.title')}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** FR-29: the primary trustee appears as the "on duty" contact. */
function OnDutyChip({ trustee, solid }: { trustee: TrusteeRow; solid: boolean }) {
  const actionClass = cn(
    'press tap-target flex items-center justify-center rounded-(--radius-input)',
    'transition-[background-color,border-color,color,transform] duration-(--duration-press)',
    'ease-(--ease-out-quiet)',
    solid
      ? 'border border-(--hairline) bg-(--surface-raised) text-(--ink) hover:border-(--hairline-strong) hover:bg-(--surface-hover)'
      : 'border border-white/25 bg-white/12 text-white backdrop-blur-sm hover:bg-white/22',
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden text-end xl:block">
        {/* Amber earns its keep here: "on duty" is one of the two time-critical
            facts in the product, and it is the only chrome that gets the
            accent. */}
        <div
          className={cn(
            'flex items-center justify-end gap-1.5 text-[0.6875rem] font-semibold',
            solid ? 'text-accent-ink' : 'text-accent',
          )}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {t('trustees.on_duty')}
        </div>
        <div className={cn('text-sm font-semibold', solid ? 'text-(--ink)' : 'text-white')}>
          {trustee.full_name}
        </div>
      </div>

      <a
        href={telLink(trustee.phone_e164)}
        className={actionClass}
        aria-label={`${t('trustees.call')} — ${trustee.full_name}`}
      >
        {/* A phone icon does not imply direction, so it must NOT mirror. */}
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
