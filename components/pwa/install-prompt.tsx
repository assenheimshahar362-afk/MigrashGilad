'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { useInstall } from '@/components/pwa/install-context';

const VISIT_KEY = 'mg.visits';
const DISMISS_KEY = 'mg.install-dismissed';

/**
 * §12: a dismissible, non-blocking banner after the SECOND visit.
 *
 * Not the first: a visitor who arrived from a WhatsApp link to check one week's
 * schedule has not yet earned an install prompt, and interrupting them costs
 * more than the install is worth.
 *
 * Whether the browser CAN install now is `<InstallProvider>`'s business (the
 * `beforeinstallprompt` event has to be captured on every visit, not only the
 * ones this banner shows on); what is left here is the nagging policy — visit
 * count and dismissal — plus the banner itself.
 */
export function InstallPrompt() {
  const { canInstall, isStandalone, isIos, promptInstall } = useInstall();
  const [earned, setEarned] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
      return;
    }
    const visits = Number(localStorage.getItem(VISIT_KEY) ?? '0') + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    setEarned(visits >= 2);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  // On iOS there is no event to wait for — the banner IS the instructions.
  if (isStandalone || dismissed || !earned || (!canInstall && !isIos)) return null;

  return (
    <div
      role="dialog"
      aria-label={t('pwa.install_title')}
      /* Clears the tab bar, and nothing else — the schedule no longer docks a
         button above it. On lg there is no tab bar either, so it drops. */
      className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-[560px] px-3 lg:bottom-6"
    >
      <div className="flex items-start gap-3 card p-4 shadow-lg">
        <Download className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="font-bold">{t('pwa.install_title')}</p>
          <p className="mt-0.5 text-sm text-(--ink-muted)">
            {canInstall ? t('pwa.install_body') : t('pwa.install_ios')}
          </p>

          {canInstall ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={async () => {
                await promptInstall();
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
          className="tap-target -me-2 -mt-2 flex items-center justify-center rounded-(--radius-input) text-(--ink-muted) hover:bg-(--surface-sunken)"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
