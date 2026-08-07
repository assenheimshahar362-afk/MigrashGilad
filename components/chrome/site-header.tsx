'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Global header.
 *
 * On a page with a hero the bar starts transparent and sits over the image;
 * past 24px of scroll it becomes the frosted white bar. The threshold is small
 * on purpose — the swap should happen as soon as the hero starts to leave, not
 * halfway down it, or the bar spends a long stretch unreadable over content.
 *
 * FR-39: the memorial mark is no longer carried in the header. It lives in the
 * footer, which links to the memorial section of /about.
 */
const LINKS = [
  { href: '/', label: t('nav.schedule'), exact: true },
  { href: '/request', label: t('nav.request'), exact: false },
  { href: '/about', label: t('nav.about'), exact: false },
  { href: '/trustees', label: t('nav.trustees'), exact: false },
  { href: '/contact', label: t('nav.contact'), exact: false },
] as const;

/** The routes whose first element is a full-bleed hero, so the bar has to start
 *  transparent and sit over it. */
const HERO_ROUTES = new Set<string>(['/']);

export function SiteHeader({ pitchName }: { pitchName: string }) {
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
      </div>
    </header>
  );
}
