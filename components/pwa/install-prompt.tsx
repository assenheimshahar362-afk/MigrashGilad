'use client';

import { useEffect, useRef, useState } from 'react';
import { useInstall } from '@/components/pwa/install-context';
import { InstallSheet } from '@/components/pwa/install-sheet';

/** When a "לא עכשיו" stops holding. A snooze rather than a permanent
 *  dismissal: the label says "not now", and the footer's button (§
 *  install-app-button.tsx) is the route back in the meantime. */
const SNOOZE_KEY = 'mg.install-snoozed';
const SNOOZE_DAYS = 14;

/** Long enough that the calendar — the reason anyone opened this — paints and
 *  is seen first, short enough that the sheet still reads as part of opening
 *  the app rather than as something that ambushed a reader mid-scroll. */
const OPEN_DELAY_MS = 1500;

/**
 * §12: the install offer, as a popup on opening the app.
 *
 * It was a docked banner above the tab bar for a while, which is quieter but
 * was also missable — on a phone it sat exactly where a thumb rests, and it
 * read as part of the page furniture rather than as an offer. This is the
 * same content in the product's own sheet (§ install-sheet.tsx), centred on
 * desktop and coming up from the bottom on a phone.
 *
 * It comes up on every open until it is answered: installed, or waved away
 * for `SNOOZE_DAYS`. Whether the browser CAN install is
 * `<InstallProvider>`'s business — `beforeinstallprompt` has to be captured
 * on every load, not only the ones this shows on — and all that is left here
 * is when to ask.
 */
export function InstallPrompt() {
  const { canInstall, isStandalone, isIos } = useInstall();
  const [snoozed, setSnoozed] = useState(true);
  const [open, setOpen] = useState(false);
  // One offer per page load. Without this, `canInstall` flipping (the browser
  // re-fires `beforeinstallprompt` after a declined install) would re-open the
  // sheet on someone who has just closed it.
  const asked = useRef(false);

  useEffect(() => {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? '0');
    setSnoozed(Date.now() < until);
  }, []);

  // On iOS there is no event to wait for — the sheet there IS the
  // instructions, so it may open as soon as the delay is up. Everywhere else
  // this waits for a real prompt to have been captured, which is why the
  // effect depends on `canInstall` rather than running once on mount.
  const eligible = !isStandalone && !snoozed && (canInstall || isIos);

  useEffect(() => {
    if (!eligible || asked.current) return;
    const timer = setTimeout(() => {
      asked.current = true;
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  return (
    <InstallSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closed by the X, by Escape, by the overlay or by "לא עכשיו" — all
        // four are the same answer, and only re-asking in two weeks respects
        // any of them.
        if (!next) {
          localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
          setSnoozed(true);
        }
      }}
    />
  );
}
