'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FilePlus2, Users, Info, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { useRequestModal } from '@/components/request/request-modal-context';

/**
 * The mobile tab bar. Hidden from `lg` up, where the header navigation takes
 * over — the two are never on screen together.
 *
 * §2 visitor rules: there is deliberately no "sign in" affordance here or
 * anywhere else in the public UI. The only route to /login is by typing it or
 * following an admin's bookmark.
 *
 * Motion: the active indicator does NOT animate between tabs. This bar is
 * tapped dozens of times a day, and at that frequency any transition — however
 * short — is felt as the app lagging behind the finger. What does animate is
 * the press itself, which is feedback rather than decoration.
 */
const TABS = [
  { href: '/', section: 'schedule', label: t('nav.schedule'), Icon: CalendarDays },
  { href: '/#about', section: 'about', label: t('nav.about'), Icon: Info },
  { href: '/#trustees', section: 'trustees', label: t('nav.trustees'), Icon: Users },
  { href: '/#contact', section: 'contact', label: t('nav.contact'), Icon: Phone },
] as const;

// The short label, not `nav.request`: five tabs on a 360px screen leave 72px
// each, and "הזמנת מגרש" wraps or truncates in every one of them. It opens
// the floating booking modal (request-modal-context.tsx) rather than linking
// anywhere, so it is rendered on its own below instead of living in TABS.
const REQUEST_TAB = { label: t('nav.request_short'), Icon: FilePlus2 };

const tabClassName = 'press tap-target relative flex flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium';

/**
 * `/`, `/#about`, `/#trustees` and `/#contact` are all the same route — the
 * home page merged into one-page anchors (§ one-page merge) — so
 * `usePathname()` alone cannot tell them apart, and the calendar tab (the
 * only one whose href IS the bare pathname) ends up permanently "active"
 * regardless of which section is actually on screen. This tracks which
 * section's midpoint is currently crossing the vertical centre of the
 * viewport instead, the same signal a visitor's own eye is using.
 */
function useActiveSection(enabled: boolean): string {
  const [active, setActive] = useState<string>('schedule');

  useEffect(() => {
    if (!enabled) return;

    const sections = TABS.map((tab) => document.getElementById(tab.section)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Several sections can straddle the line at once on a short viewport;
        // the one closest to the top wins, matching what a visitor would call
        // "the section I'm looking at".
        const crossing = entries.filter((entry) => entry.isIntersecting);
        if (crossing.length === 0) return;
        const topmost = crossing.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        );
        setActive(topmost.target.id);
      },
      // A zero-height line near the top third of the viewport, rather than
      // dead centre — a section only has to arrive, not be centred, to read
      // as "current", which also gives a short trailing section (contact,
      // shorter than the ones before it) more room to cross it at all.
      { rootMargin: '-30% 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));

    // Safety net for that same short-last-section case: if it's too short to
    // ever cross the line above, the page still runs out of room to scroll
    // — reaching the bottom of the document is itself an unambiguous "the
    // last section is what's on screen", independent of its height.
    const lastSection = TABS.at(-1)?.section ?? 'contact';
    const onScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) setActive(lastSection);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  return active;
}

export function BottomNav() {
  const pathname = usePathname();
  const onHome = pathname === '/';
  const activeSection = useActiveSection(onHome);
  const { openRequestModal } = useRequestModal();

  return (
    <nav
      aria-label={t('nav.primary')}
      className={cn(
        'chrome-blur sticky bottom-0 z-30 border-t border-(--hairline) safe-bottom lg:hidden',
      )}
    >
      <ul className="mx-auto flex max-w-[560px]">
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openRequestModal()}
            className={cn(tabClassName, 'w-full text-(--ink-muted)')}
          >
            <REQUEST_TAB.Icon className="relative size-[22px]" aria-hidden strokeWidth={1.75} />
            <span className="relative max-w-full text-center">{REQUEST_TAB.label}</span>
          </button>
        </li>

        {TABS.map(({ href, section, label, Icon }) => {
          const active = onHome && activeSection === section;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  tabClassName,
                  active ? 'text-primary-700 font-semibold' : 'text-(--ink-muted)',
                )}
              >
                {/* The lit pill behind the active icon. Brand green at 10% is
                    enough to read as "you are here" without competing with the
                    primary CTA that often sits directly above it. */}
                <span
                  aria-hidden
                  className={cn(
                    // `max-w-full`: five tabs on a 320px phone leave 64px each,
                    // which is narrower than this pill's own 3.5rem once the
                    // accessibility font scale is raised.
                    'absolute top-1 h-8 w-14 max-w-full rounded-(--radius-chip)',
                    active ? 'bg-primary-50' : 'bg-transparent',
                  )}
                />
                <Icon
                  className={cn('relative size-[22px]', active && 'text-primary-600')}
                  aria-hidden
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="relative max-w-full text-center">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
