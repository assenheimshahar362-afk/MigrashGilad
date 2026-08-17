'use client';

import { useRef } from 'react';

/**
 * The whole calendar sits inside `<WeekSwipe>`, and a horizontal swipe that
 * starts on something clickable still ends with a `click` on it — the browser
 * only suppresses that after a real scroll, and the horizontal axis is ours
 * (§ week-swipe.tsx, `touch-action: pan-y`). Without this, changing the week
 * by swiping across the grid would also fire whatever the finger landed on.
 *
 * Shared by every tap target drawn ON the calendar, so an event block and a
 * day column cannot disagree about what counts as a tap.
 */

/** How far a pointer may travel between press and release and still be a tap. */
const TAP_SLOP = 10;

export function useTapGuard() {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (pointer: React.PointerEvent) => {
      pressedAt.current = { x: pointer.clientX, y: pointer.clientY };
    },
    onPointerCancel: () => {
      pressedAt.current = null;
    },
    /**
     * Whether this click should act. `detail === 0` is a keyboard activation
     * (Enter/Space): it reports coordinates of 0,0, which would read as a drag
     * from anywhere else on the screen, so it never goes through the check.
     */
    isTap: (click: React.MouseEvent) => {
      const start = pressedAt.current;
      pressedAt.current = null;
      if (click.detail === 0 || !start) return true;
      return Math.hypot(click.clientX - start.x, click.clientY - start.y) <= TAP_SLOP;
    },
  };
}
