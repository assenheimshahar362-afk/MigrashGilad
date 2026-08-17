'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallContextValue {
  /** A real install prompt is available — Chrome/Edge/Android. */
  canInstall: boolean;
  /** Already running from the home screen; there is nothing left to install. */
  isStandalone: boolean;
  /** iOS never fires `beforeinstallprompt`: installing there is a manual
   *  Share → "Add to Home Screen", so the UI has to explain rather than act. */
  isIos: boolean;
  /** Shows the browser's own install dialog. Resolves to whether it was
   *  accepted; `false` when there was no prompt to show. */
  promptInstall: () => Promise<boolean>;
}

const InstallContext = createContext<InstallContextValue | null>(null);

/**
 * §12 install state, in one place.
 *
 * `beforeinstallprompt` fires ONCE per page load, early, and only a listener
 * that was already attached can capture it — so it cannot be listened for
 * conditionally. The banner (`install-prompt.tsx`) used to own that listener
 * and only attached it from the second visit onwards, which meant any other
 * affordance — the footer's install button, say — had nothing to fire on a
 * first visit or after the banner was dismissed. This provider always listens;
 * WHEN to nag about it stays the banner's own business.
 */
export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      // Chrome shows its own mini-infobar unless this is prevented; the whole
      // point is to choose our own moment for it.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    // Fired after an install completes by any route, including the browser's
    // own menu — the affordances have to disappear then, not linger.
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // A prompt cannot be shown twice; the browser re-fires
    // `beforeinstallprompt` if the visitor declined and is still eligible.
    setDeferred(null);
    return outcome === 'accepted';
  }, [deferred]);

  const value = useMemo(
    () => ({ canInstall: deferred !== null, isStandalone, isIos, promptInstall }),
    [deferred, isStandalone, isIos, promptInstall],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error('useInstall must be used within InstallProvider');
  return ctx;
}
