'use client';

import * as React from 'react';
import { useEventDetail } from '@/components/schedule/event-detail-context';
import { useTapGuard } from '@/components/schedule/tap-guard';
import type { PublicEvent } from '@/lib/types';

/**
 * The tap target around an event, wherever the calendar draws one at a size
 * worth aiming at — a block on the week grid from `sm` up, a card in the day
 * view at every width. Below `sm` the week grid's blocks are a few pixels
 * wide, so there they are not targets at all and the day column is (§
 * week-grid.tsx `DayOpenLink`).
 *
 * It is a real `<button>`, so it is reachable by keyboard and announced as a
 * control; the caller supplies the accessible name, since only the caller
 * knows how its own contents already read.
 */
export function EventDetailTrigger({
  event,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<'button'>, 'onClick' | 'type'> & {
  event: PublicEvent;
}) {
  const { openEventDetail } = useEventDetail();
  const tap = useTapGuard();

  return (
    <button
      type="button"
      onPointerDown={tap.onPointerDown}
      onPointerCancel={tap.onPointerCancel}
      onClick={(click) => {
        if (tap.isTap(click)) openEventDetail(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
