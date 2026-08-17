'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PublicEvent } from '@/lib/types';
import { EventDetailSheet } from '@/components/schedule/event-detail-sheet';

interface EventDetailContextValue {
  openEventDetail: (event: PublicEvent) => void;
  closeEventDetail: () => void;
}

const EventDetailContext = createContext<EventDetailContextValue | null>(null);

/**
 * Holds the one open event on the public calendar, and mounts the one sheet
 * that shows it. Mounted in the public layout, above every calendar shape
 * (week grid, day view) so all of them open the same sheet — the same
 * arrangement `<RequestModalProvider>` uses, and for the same reason.
 *
 * The context value carries the two openers ONLY, never the open state: every
 * block on the grid consumes this, and putting `event` in the value would
 * re-render all of them each time one is opened.
 */
export function EventDetailProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openEventDetail = useCallback((next: PublicEvent) => {
    setEvent(next);
    setIsOpen(true);
  }, []);

  // The event is deliberately NOT cleared here — the sheet's exit animation is
  // still playing, and emptying it first would blank the panel on the way out.
  const closeEventDetail = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ openEventDetail, closeEventDetail }),
    [openEventDetail, closeEventDetail],
  );

  return (
    <EventDetailContext.Provider value={value}>
      {children}
      <EventDetailSheet event={event} open={isOpen} onOpenChange={setIsOpen} />
    </EventDetailContext.Provider>
  );
}

export function useEventDetail(): EventDetailContextValue {
  const ctx = useContext(EventDetailContext);
  if (!ctx) throw new Error('useEventDetail must be used within EventDetailProvider');
  return ctx;
}
