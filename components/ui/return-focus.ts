'use client';

import { useCallback, useRef } from 'react';

/**
 * Puts focus back where it came from when a dialog closes.
 *
 * Radix does this by itself for a dialog opened through its own `<Trigger>`,
 * but the two dialogs in the public site are opened from a context instead —
 * the booking modal (header, footer, tab bar, hero all open the same one) and
 * the calendar's event sheet — so Radix has no trigger to return to and focus
 * falls back to `<body>`. A keyboard or screen-reader user is then dropped at
 * the very top of the document and has to walk back down to where they were,
 * which is the failure WCAG 2.4.3 describes.
 *
 * Usage: call `remember()` at the moment the dialog is opened, and hand
 * `onCloseAutoFocus` to the dialog's content.
 */
export function useReturnFocus() {
  const previous = useRef<HTMLElement | null>(null);

  const remember = useCallback(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    const target = previous.current;
    // Gone from the DOM (the calendar re-rendered under the sheet, say), or
    // never focused in the first place — Safari does not focus a button on
    // click. Radix's own fallback is better than forcing focus nowhere.
    if (!target || !target.isConnected) return;
    event.preventDefault();
    // `preventScroll`: the element is usually still where the reader left it,
    // and yanking the viewport back to it would undo their scrolling.
    target.focus({ preventScroll: true });
  }, []);

  return { remember, onCloseAutoFocus };
}
