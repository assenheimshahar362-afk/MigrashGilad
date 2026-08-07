'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISIT_KEY = 'mg.visits';
const DISMISS_KEY = 'mg.install-dismissed';

/**
 * §12: a dismissible, non-blocking banner after the SECOND visit.
 *
 * Not the first: a visitor who arrived from a WhatsApp link to check one week's
 * schedule has not yet earned an install prompt, and interrupting them costs
 * more than the install is worth.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (standalone || localStorage.getItem(DISMISS_KEY) === '1') return;

    const visits = Number(localStorage.getItem(VISIT_KEY) ?? '0') + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits < 2) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires beforeinstallprompt, so the banner there is instructions
    // rather than a button (§12).
    if (isIos()) setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label={t('pwa.install_title')}
      className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-[720px] px-3 pb-2"
    >
      <div className="flex items-start gap-3 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4 shadow-lg">
        <Download className="mt-0.5 size-5 shrink-0 text-floodlight" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="font-bold">{t('pwa.install_title')}</p>
          <p className="mt-0.5 text-sm text-[--ink-muted]">
            {deferred ? t('pwa.install_body') : t('pwa.install_ios')}
          </p>

          {deferred ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                dismiss();
              }}
            >
              {t('pwa.install_action')}
            </Button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t('pwa.install_dismiss')}
          className="tap-target -me-2 -mt-2 flex items-center justify-center rounded-[--radius-input] text-[--ink-muted] hover:bg-[--surface-sunken]"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
