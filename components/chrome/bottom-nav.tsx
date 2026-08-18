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
  // `routes`: the OTHER pathnames a tab stands for. None of them has one at
  // the moment — the calendar is a single route again since the month view was
  // removed — but the mechanism stays, because the alternative is the tab bar
  // silently lighting nothing on any second calendar route added later.
  { href: '/', section: 'schedule', routes: [], label: t('nav.schedule'), Icon: CalendarDays },
  { href: '/#about', section: 'about', routes: [], label: t('nav.about'), Icon: Info },
  { href: '/#trustees', section: 'trustees', routes: [], label: t('nav.trustees'), Icon: Users },
  { href: '/#contact', section: 'contact', routes: [], label: t('nav.contact'), Icon: Phone },
] as const;

// The short label, not `nav.request`: five tabs on a 360px screen leave 72px
// each, and "הזמנת מגרש" wraps or truncates in every one of them. It opens
// the floating booking modal (request-modal-context.tsx) rather than linking
// anywhere, so it is rendered on its own below instead of living in TABS.
const REQUEST_TAB = { label: t('nav.request_short'), Icon: FilePlus2 };

const tabClassName = 'press tap-target relative flex flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium';

/** Where down the viewport a section has to reach before it counts as the one
 *  being looked at. A third of the way down rather than dead centre: a section
 *  only has to arrive to read as current. */
const CURRENT_LINE = 0.35;

/**
 * `/`, `/#about`, `/#trustees` and `/#contact` are all the same route — the
 * home page merged into one-page anchors (§ one-page merge) — so
 * `usePathname()` alone cannot tell them apart, and the calendar tab (the
 * only one whose href IS the bare pathname) would end up permanently "active"
 * regardless of which section is actually on screen. This answers the question
 * from scroll position instead, the same signal a visitor's own eye is using.
 *
 * It MEASURES rather than observing. An `IntersectionObserver` over a thin
 * band was the obvious shape for this and was wrong three ways, all of which
 * showed up as a tab bar stuck on the wrong icon:
 *
 *   - It only reports CHANGES. Scrolling back up past the first section left
 *     nothing crossing the band, which is indistinguishable from "nothing has
 *     changed" — so the last section to have been lit stayed lit at the top of
 *     the page, where the calendar is what is actually on screen.
 *   - A section shorter than the gap between the band's edges (or a tall
 *     phone) can pass through without ever generating a crossing at all.
 *   - Anything that changes the page's height AFTER load — the hero image
 *     arriving, a week swipe redrawing a taller grid — moves every section
 *     without any scrolling, and an observer that has already fired has
 *     nothing more to say. A measurement re-runs.
 *
 * Reading four `getBoundingClientRect()`s inside a `requestAnimationFrame` is
 * cheap enough to do on every scroll frame: they are laid out already, and the
 * read happens at the moment the browser is about to paint anyway.
 */
function useActiveSection(enabled: boolean): string {
  const [active, setActive] = useState<string>(TABS[0].section);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;

    const measure = () => {
      frame = 0;

      const line = window.innerHeight * CURRENT_LINE;
      // The last section whose top has passed the line is the current one;
      // above all of them — the hero — the calendar is what is on screen, and
      // TABS[0] is already the default this starts from.
      let current: string = TABS[0].section;
      let lastPresent: string = TABS[0].section;

      for (const tab of TABS) {
        const element = document.getElementById(tab.section);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        // A section with no height yet is a section the browser has not laid
        // out — streamed HTML that has not arrived, a suspended boundary. Its
        // top reads as 0, which is "above the line" for every section at once,
        // and the LAST one would win: for the second or so before the page
        // finishes arriving the bar lit "יצירת קשר" on a visitor who was
        // looking at the calendar. Nothing that measures 0 gets a vote.
        if (rect.height === 0) continue;
        lastPresent = tab.section;
        if (rect.top <= line) current = tab.section;
      }

      // The last section is usually shorter than the ones above it and sits
      // over a tall footer, so on a big screen it can never reach the line.
      // Running out of page to scroll is itself an unambiguous "this is the
      // end", independent of any section's height.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atBottom ? lastPresent : current);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The two silent movers: a hash jump on load lands before the sections
    // have their final geometry, and anything that changes the document's
    // height (images, a swiped-in week) shifts every section without a scroll
    // or a resize event to announce it.
    window.addEventListener('hashchange', schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
      resizeObserver.disconnect();
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
        'chrome-blur fixed inset-x-0 bottom-0 z-30 border-t border-(--hairline) safe-bottom lg:hidden',
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

        {TABS.map(({ href, section, routes, label, Icon }) => {
          // On the home page the tab follows the section being read; anywhere
          // else it follows the route. A public page that belongs to no tab
          // (the rules and accessibility pages, both reached from the footer)
          // correctly lights none of them rather than leaving whichever tab
          // was lit before still lit.
          const active = onHome
            ? activeSection === section
            : (routes as readonly string[]).includes(pathname);
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
