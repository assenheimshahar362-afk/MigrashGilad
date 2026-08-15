'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LocalDate } from '@/lib/time';

/**
 * FR-6: week navigation must be swipeable on touch devices. This is where that
 * lives — it wraps the whole calendar block (nav strip, view toggle and
 * whichever view is showing), so the gesture works anywhere on the calendar
 * rather than only on the thin nav row it used to be bound to.
 *
 * The content follows the finger while the gesture is undecided or horizontal,
 * which is the part that makes it read as a swipe rather than as a tap that
 * happens to change the week: without it there is no feedback until the server
 * responds, and a half-swipe looks identical to a dropped one. Past
 * `SWIPE_MIN_X` the release commits; short of it, it springs back and the week
 * does not change.
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

/** Movement before the gesture is locked to one axis. Below this a touch is
 *  still just noise from a finger landing, and reading an axis out of it picks
 *  the wrong one about half the time. Once locked, the lock holds for the rest
 *  of the gesture — a swipe that drifts vertically mid-travel keeps following
 *  the finger instead of stuttering between the two behaviours. */
const AXIS_LOCK_SLOP = 10;

/** The furthest the content travels, however far the finger goes. The pull is
 *  1:1 at first and tapers to this asymptote, so the grid stays attached to the
 *  finger without ever leaving its own card behind. */
const MAX_PULL = 64;

/** Where the content waits between a committed swipe and the new week
 *  arriving. Small and on the side the swipe was heading — enough that the
 *  gesture visibly took, not so much that a slow response looks broken. */
const COMMIT_HOLD = 24;

type Gesture = { x: number; y: number; axis: 'undecided' | 'x' | 'y' };

/** `offset` is where the content sits; `animated` is whether it should travel
 *  there or be dragged there. Kept as one piece of state because they always
 *  change together and must never render out of step — an animated frame at a
 *  drag position lags the finger. */
type Drag = { offset: number; animated: boolean };

const AT_REST: Drag = { offset: 0, animated: true };

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
  const [drag, setDrag] = useState<Drag>(AT_REST);
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
    setDrag(AT_REST);
  }

  // Safety release for `COMMIT_HOLD`: the week changing is what normally puts
  // the content back (above), but a navigation that resolves to the week we are
  // already on would otherwise leave it held off-centre forever.
  useEffect(() => {
    if (!pending) setDrag(AT_REST);
  }, [pending]);

  const cancel = () => {
    gesture.current = null;
    setDrag(AT_REST);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    // A second finger is a pinch-zoom, and a swipe on top of a week that is
    // already loading would queue a second navigation behind the first.
    if (pending || event.touches.length > 1) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    if (touch) gesture.current = { x: touch.clientX, y: touch.clientY, axis: 'undecided' };
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const current = gesture.current;
    const touch = event.touches[0];
    if (!current || !touch) return;
    if (event.touches.length > 1) {
      cancel();
      return;
    }

    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;

    if (current.axis === 'undecided') {
      if (Math.abs(dx) < AXIS_LOCK_SLOP && Math.abs(dy) < AXIS_LOCK_SLOP) return;
      current.axis = Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y';
    }
    if (current.axis === 'y') return;

    setDrag({ offset: rubberBand(dx), animated: false });
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const current = gesture.current;
    const touch = event.changedTouches[0];
    gesture.current = null;
    if (!current || !touch) {
      setDrag(AT_REST);
      return;
    }

    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;

    // Re-checked against the whole gesture rather than trusting the axis lock:
    // the lock only decides who follows the finger, this decides whether the
    // week actually changes.
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) {
      setDrag(AT_REST);
      return;
    }

    // RTL: dragging the content to the right reveals what is to its left, which
    // is the next week.
    setDrag({ offset: Math.sign(dx) * COMMIT_HOLD, animated: true });
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
      onTouchCancel={cancel}
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
          direction === 'forward' && 'animate-week-forward',
          direction === 'back' && 'animate-week-back',
        )}
        style={{
          // Left off entirely at rest: this element is an ancestor of the day
          // strip's `position: sticky` header, and a transform that is never
          // removed leaves a containing block behind for it to fight with.
          transform: drag.offset === 0 ? undefined : `translate3d(${drag.offset}px, 0, 0)`,
          transition: drag.animated
            ? 'transform var(--duration-pop) var(--ease-out-quiet)'
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** 1:1 at the start, tapering to `MAX_PULL`. The exponential is what keeps the
 *  first millimetre honest — a plain `min()` clamp feels attached right up to
 *  the moment it locks solid, which reads as the gesture having been dropped. */
function rubberBand(dx: number): number {
  return Math.sign(dx) * MAX_PULL * (1 - Math.exp(-Math.abs(dx) / MAX_PULL));
}
