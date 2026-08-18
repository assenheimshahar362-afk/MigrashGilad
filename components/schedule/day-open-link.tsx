'use client';

import Link from 'next/link';
import { useTapGuard } from '@/components/schedule/tap-guard';

/**
 * The phone-sized tap target on the week grid: the whole day column, opening
 * that day in the day view.
 *
 * A11Y-1 / WCAG 2.5.8 is why this exists. On a 375px screen a day column is
 * about 45px wide, and an event that shares its slot with another gets half of
 * that — a 19px sliver, well under the 24px minimum, and not something everyone
 * can hit with a thumb. The blocks are still controls of their own at this
 * width (§ event-block.tsx: a tap on an event opens that event's sheet, which
 * is what a visitor expects of a calendar) — this is the generous target for
 * everything AROUND them, so the gaps between bookings, and any block too
 * narrow to aim at, still lead somewhere: the day view, where each event is a
 * full-width card that opens the same sheet.
 *
 * An overlay rather than a wrapper, so it never contains the blocks, which are
 * buttons — nesting a button inside a link is invalid and unreachable by
 * keyboard. It sits BELOW them (z-20 against their z-30) so an event keeps its
 * own taps.
 */
export function DayOpenLink({ href, label }: { href: string; label: string }) {
  const tap = useTapGuard();

  return (
    <Link
      href={href}
      aria-label={label}
      scroll={false}
      onPointerDown={tap.onPointerDown}
      onPointerCancel={tap.onPointerCancel}
      onClick={(click) => {
        // A swipe that started on this column is a week change, not a request
        // to open the day (§ tap-guard.ts).
        if (!tap.isTap(click)) click.preventDefault();
      }}
      className="absolute inset-0 z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:hidden"
    />
  );
}
