'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** How long to keep re-asserting the scroll after arriving at a section, and
 *  at what cadence. The router does its own scroll handling around a
 *  navigation and the page's height keeps changing while images land, so a
 *  single attempt lands correctly only some of the time — see below. */
const RETRY_MS = [0, 120, 350, 700];

/**
 * Scrolls to `/#about`, `/#trustees` and `/#contact` when a visitor arrives at
 * one of them from another route.
 *
 * The App Router does this itself on a cold load and on a hash change within
 * the page, but not reliably on a client-side navigation into a route it has
 * already cached: the tab-bar and footer links from /rules or /accessibility
 * back to `/#contact` land at scroll position 0 with the hash sitting in the
 * URL and nothing having moved.
 *
 * It surfaces as the tab bar being "stuck": tapping יצירת קשר lights לוח
 * זמנים instead. That reading is CORRECT — the calendar is what is on screen,
 * and `bottom-nav.tsx` deliberately reports what a visitor can see rather than
 * what the URL claims — so the fix belongs here, at the navigation.
 *
 * Why a retry window rather than one scroll: the router performs its own
 * scroll around the same commit, and which of the two runs last depends on
 * whether the destination was already in its cache. Re-asserting for
 * `RETRY_MS` covers both orders, and is also what makes the landing survive
 * the hero image arriving underneath and reflowing everything below it. Each
 * repeat is a no-op once the section is already in place, and the whole window
 * is abandoned the moment the visitor scrolls for themselves — being dragged
 * back to an anchor you have just scrolled away from is worse than landing in
 * the wrong place to begin with.
 *
 * Mounted once in the public layout, so every route into a section is covered:
 * the header, the footer and the tab bar all point at the same four anchors.
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const scrollToHash = () => {
      if (cancelled) return;
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      // `scroll-mt-*` on each section is what keeps the sticky header off the
      // heading; `scrollIntoView` honours it, an absolute `scrollTo` would not.
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    };

    const stop = () => {
      cancelled = true;
    };

    const settle = () => {
      cancelled = false;
      timers.forEach(clearTimeout);
      timers.length = 0;
      RETRY_MS.forEach((delay) => timers.push(setTimeout(scrollToHash, delay)));
    };

    if (window.location.hash) settle();
    // A hash change with no route change (tapping אודות while already on the
    // home page) is the browser's own business, but the same reflow-underneath
    // applies, so the same window runs.
    window.addEventListener('hashchange', settle);
    // Anything the visitor does themselves ends the window immediately.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', stop);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('hashchange', settle);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [pathname]);

  return null;
}
