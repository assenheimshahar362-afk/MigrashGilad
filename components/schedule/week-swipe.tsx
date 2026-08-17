'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LocalDate } from '@/lib/time';

/**
 * FR-6: week navigation must be swipeable on touch devices. This is where that
 * lives — it wraps the whole calendar block (nav strip, view toggle and
 * whichever view is showing), so the gesture works anywhere on the calendar
 * rather than only on the thin nav row it used to be bound to.
 *
 * The calendar does NOT follow the finger. It used to — the content was
 * dragged up to 64px with a rubber-band curve — and the gesture read well in
 * isolation, but the element being dragged is the whole block: the week nav,
 * the view toggle and the grid card together. Sliding all of it left the card
 * hanging over the shell's own margin, so a swipe looked like the page had
 * come loose rather than like a calendar being turned. Nothing moves during
 * the gesture now; the arriving week's entrance (`animate-week-*`, a 20px
 * settle inside the block) is what says the swipe took, along with the brief
 * dim below while the new week is on its way.
 *
 * Only touch is handled. A mouse drag is deliberately NOT a week change — on a
 * desktop the chevrons are always visible and a drag there is a text selection,
 * not a gesture.
 */

/** How far across the finger must travel for a release to commit, and how much
 *  more horizontal than vertical the whole gesture has to be. A vertical scroll
 *  must never be read as a week change: the grid is taller than the viewport,
 *  so scrolling is by far the more common gesture over exactly this element. */
const SWIPE_MIN_X = 60;
const SWIPE_AXIS_RATIO = 1.5;

type Gesture = { x: number; y: number };

export function WeekSwipe({
  weekStart,
  prevHref,
  nextHref,
  children,
}: {
  weekStart: LocalDate;
  prevHref: string;
  nextHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const gesture = useRef<Gesture | null>(null);
  const [pending, startTransition] = useTransition();

  // Which way the week last moved, so the arriving week enters from the side it
  // came from. Derived from the prop rather than from the gesture on purpose:
  // the chevrons and the date picker change the week too, and all three should
  // animate the same way. (React's "adjust state during render" pattern — this
  // is a render-time comparison, not an effect, so the new week never paints
  // once without its direction and then again with it.)
  const [shownWeek, setShownWeek] = useState(weekStart);
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null);
  if (weekStart !== shownWeek) {
    setDirection(weekStart > shownWeek ? 'forward' : 'back');
    setShownWeek(weekStart);
  }

  const onTouchStart = (event: React.TouchEvent) => {
    // A second finger is a pinch-zoom, and a swipe on top of a week that is
    // already loading would queue a second navigation behind the first.
    if (pending || event.touches.length > 1) {
      gesture.current = null;
      return;
    }
    const touch = event.touches[0];
    if (touch) gesture.current = { x: touch.clientX, y: touch.clientY };
  };

  // Nothing to draw mid-gesture any more; this exists only to drop a gesture
  // that turned into a pinch.
  const onTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length > 1) gesture.current = null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const current = gesture.current;
    const touch = event.changedTouches[0];
    gesture.current = null;
    if (!current || !touch) return;

    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;

    // Far enough across, and decisively more horizontal than vertical — the
    // page scrolls over this element constantly, and a scroll that drifts
    // sideways must not turn the week.
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;

    // RTL: dragging the content to the right reveals what is to its left, which
    // is the next week.
    //
    // `scroll: false`: a week change is a change of CONTENT inside a calendar
    // the visitor is already looking at, not a new page. Next's default is to
    // scroll to the top of the page element whenever it is not fully in the
    // viewport, which on a phone — where the grid is taller than the screen and
    // the schedule sits below the hero — fires on essentially every swipe and
    // throws the reader back up to the top of the site.
    startTransition(() => router.push(dx > 0 ? nextHref : prevHref, { scroll: false }));
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        gesture.current = null;
      }}
      // Vertical scrolling and pinch-zoom stay with the browser; the horizontal
      // axis is ours, and nothing in here scrolls sideways for it to steal.
      // `pinch-zoom` is spelled out because dropping it would make the calendar
      // — the one thing on this page a visitor might want to magnify — the one
      // place on the site they cannot (A11Y).
      style={{ touchAction: 'pan-y pinch-zoom' }}
    >
      {/* Keyed by the week so a second swipe the same way replays the entrance
          rather than being reconciled into a class that is already there. */}
      <div
        key={weekStart}
        onAnimationEnd={(event) => {
          // Only this element's own entrance. The subtree below is full of
          // `.stagger` and `.animate-rise-in` children whose animations bubble
          // through here and would otherwise clear the class mid-travel.
          if (event.target === event.currentTarget) setDirection(null);
        }}
        className={cn(
          // The committed-swipe feedback, in place of the old rubber-band pull:
          // opacity moves nothing, so the card keeps its exact position and the
          // shell's margins hold. It lasts only as long as the server takes.
          'transition-opacity duration-(--duration-tip) ease-(--ease-out-quiet)',
          pending && 'opacity-60',
          direction === 'forward' && 'animate-week-forward',
          direction === 'back' && 'animate-week-back',
        )}
      >
        {children}
      </div>
    </div>
  );
}
