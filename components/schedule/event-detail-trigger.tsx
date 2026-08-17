'use client';

import * as React from 'react';
import { useRef } from 'react';
import { useEventDetail } from '@/components/schedule/event-detail-context';
import type { PublicEvent } from '@/lib/types';

/**
 * The tap target around an event, wherever the calendar draws one — a block on
 * the week grid, a card in the day view. It is the ONLY client component in
 * either view: both stay server-rendered, and only this button and the sheet
 * it opens ship to the browser.
 *
 * It is a real `<button>`, so it is reachable by keyboard and announced as a
 * control; the caller supplies the accessible name, since only the caller
 * knows how its own contents already read.
 */

/** How far a pointer may travel between press and release and still count as a
 *  tap. The whole calendar sits inside `<WeekSwipe>`, and a horizontal swipe
 *  that starts on an event still ends with a `click` on it — the browser only
 *  suppresses that after a real scroll, and the swipe axis is ours (§
 *  week-swipe.tsx, `touch-action: pan-y`). Without this, changing the week by
 *  swiping across the grid would also open whatever block the finger landed
 *  on. */
const TAP_SLOP = 10;

export function EventDetailTrigger({
  event,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<'button'>, 'onClick' | 'type'> & {
  event: PublicEvent;
}) {
  const { openEventDetail } = useEventDetail();
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  return (
    <button
      type="button"
      onPointerDown={(pointer) => {
        pressedAt.current = { x: pointer.clientX, y: pointer.clientY };
      }}
      onPointerCancel={() => {
        pressedAt.current = null;
      }}
      onClick={(click) => {
        const start = pressedAt.current;
        pressedAt.current = null;
        // `detail === 0` is a keyboard activation (Enter/Space): it reports
        // coordinates of 0,0, which would read as a drag from anywhere else on
        // the screen, so it never goes through the slop check.
        if (click.detail > 0 && start) {
          const travelled = Math.hypot(click.clientX - start.x, click.clientY - start.y);
          if (travelled > TAP_SLOP) return;
        }
        openEventDetail(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
