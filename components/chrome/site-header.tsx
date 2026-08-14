'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import logoMark from '@/public/images/logo-mark.webp';
import { PitchWordmark } from '@/components/chrome/pitch-wordmark';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AuthIcons } from '@/components/chrome/auth-icons';
import { RequestNavTrigger } from '@/components/request/request-nav-trigger';

/**
 * Global header.
 *
 * On a page with a hero the bar starts transparent and sits over the image;
 * past 24px of scroll it becomes the frosted white bar. The threshold is small
 * on purpose — the swap should happen as soon as the hero starts to leave, not
 * halfway down it, or the bar spends a long stretch unreadable over content.
 */
/**
 * The schedule is deliberately absent: it IS the landing page, and the badge to
 * its start already goes there. A nav item pointing at the page you are almost
 * always on is a slot spent saying nothing.
 *
 * "request" is not a link at all any more — it opens the floating booking
 * modal (`request-modal-context.tsx`) from wherever you are, which is why it
 * works identically from the month view or a request-status page without
 * navigating home first the way an anchor would have. Every other entry is
 * still an anchor into the home page (§ one-page merge).
 */
const LINKS = [
  { href: '/#about', label: t('nav.about') },
  { href: '/#trustees', label: t('nav.trustees') },
  { href: '/#contact', label: t('nav.contact') },
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

  const navItemClassName = cn(
    'press tap-target-coarse flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap',
    'transition-[background-color,color,box-shadow] duration-(--duration-tip)',
    'ease-(--ease-out-quiet)',
    solid ? 'text-(--ink-muted) hover:text-(--ink)' : 'text-white/85 hover:text-white',
  );

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
      {/* Three columns from `lg`, with the outer two at `1fr`: that is what
          centres the navigation against the BAR rather than against the space
          left over by the badge, which is much wider than the icons opposite
          it. Below `lg` there is no navigation to centre, so it stays a flex
          row. */}
      <div className="shell flex items-center gap-4 py-3 sm:py-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          // Shrinkable on purpose: the wordmark beside the badge already
          // truncates, but a `shrink-0` here would stop that from ever
          // engaging and push the whole bar wider than a 320px phone once the
          // accessibility font scale enlarges the name.
          className="press-sm tap-target-coarse flex min-w-0 items-center gap-2.5 rounded-(--radius-input) py-0.5"
          aria-label={pitchName}
        >
          {/* The badge is decorative here: the name it carries is set beside it
              in real text, which is what the accessible name comes from. Over
              the hero it gets a soft ring, because the artwork's own cream disc
              would otherwise float on a dark photograph with no edge. */}
          <Image
            src={logoMark}
            alt=""
            width={40}
            height={40}
            priority
            className={cn(
              'size-9 shrink-0 rounded-full sm:size-10',
              'transition-[box-shadow] duration-300',
              solid ? 'shadow-none' : 'shadow-[0_0_0_1px_rgb(255_255_255/0.25)]',
            )}
          />

          <span className="min-w-0">
            <PitchWordmark
              name={pitchName}
              className={cn(
                'font-display text-h3 leading-tight font-bold transition-colors duration-300',
                solid ? 'text-(--ink)' : 'text-white drop-shadow-sm',
              )}
            />
          </span>
        </Link>

        {/* Desktop navigation. The bottom tab bar covers mobile, so this is
            simply hidden below lg rather than duplicated into a hamburger.

            The links sit inside one tinted track rather than floating as four
            separate words. That gives the centre column an edge of its own, so
            it reads as a single control between the badge and the account
            icons instead of as text that happens to be in the middle. */}
        <nav aria-label={t('nav.primary')} className="hidden lg:block lg:justify-self-center">
          <ul
            className={cn(
              'flex items-center gap-0.5 rounded-full p-1',
              'transition-[background-color,border-color] duration-300',
              solid
                ? 'border border-(--hairline) bg-(--surface-sunken)'
                : 'border border-white/15 bg-white/10 backdrop-blur-sm',
            )}
          >
            {/* No "active" state: every link is an anchor on the same page,
                so pathname alone can no longer tell them apart, and a
                scroll-spy is more machinery than a nav bar earns. */}
            <li>
              <RequestNavTrigger className={navItemClassName}>
                {t('nav.request')}
              </RequestNavTrigger>
            </li>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={navItemClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* `ms-auto` is what pushes this to the end on a phone, where the
            navigation above is hidden and the row is still a flex line. From
            `lg` the row is a three-column grid and the grid places it instead. */}
        <div className="ms-auto flex shrink-0 items-center lg:ms-0 lg:justify-self-end">
          <AuthIcons onDark={!solid} />
        </div>
      </div>
    </header>
  );
}
