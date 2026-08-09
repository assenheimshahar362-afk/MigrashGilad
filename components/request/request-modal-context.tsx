'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface RequestModalPrefill {
  date?: string;
  start?: string;
  end?: string;
}

interface RequestModalContextValue {
  isOpen: boolean;
  prefill: RequestModalPrefill;
  openRequestModal: (prefill?: RequestModalPrefill) => void;
  closeRequestModal: () => void;
}

const RequestModalContext = createContext<RequestModalContextValue | null>(null);

/**
 * The pitch-booking form used to be `<section id="request">` on the home
 * page, reached by scrolling or by an anchor link. It is now a floating
 * modal instead, so it has to be triggerable from anywhere in the public
 * chrome (hero CTA, header nav, footer nav, the bottom tab bar) — none of
 * which are one another's ancestor or descendant. A context mounted once in
 * the public layout, above all of them, is what makes that possible without
 * threading callbacks through every layer.
 *
 * `prefill` carries an optional date/time so a future "book this slot" tap
 * on the calendar grid can open the form already filled in, the same way the
 * old `/?date=&start=&end=` query params used to.
 */
export function RequestModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<RequestModalPrefill>({});

  const openRequestModal = useCallback((next: RequestModalPrefill = {}) => {
    setPrefill(next);
    setIsOpen(true);
  }, []);

  const closeRequestModal = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, prefill, openRequestModal, closeRequestModal }),
    [isOpen, prefill, openRequestModal, closeRequestModal],
  );

  return <RequestModalContext.Provider value={value}>{children}</RequestModalContext.Provider>;
}

export function useRequestModal(): RequestModalContextValue {
  const ctx = useContext(RequestModalContext);
  if (!ctx) throw new Error('useRequestModal must be used within RequestModalProvider');
  return ctx;
}
