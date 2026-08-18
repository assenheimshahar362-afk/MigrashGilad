'use client';

import { Share, Plus, Check, MoreVertical } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { useInstall } from '@/components/pwa/install-context';

/**
 * §12: the one install dialog, in the same sheet every other dialog in the
 * product uses. Both routes to installing open THIS — the popup that comes up
 * on opening the app (`install-prompt.tsx`) and the footer's own button
 * (`install-app-button.tsx`) — so what a visitor is told about installing
 * never depends on which of the two they reached it through.
 *
 * What it shows depends on what the browser actually allows:
 *   - A captured `beforeinstallprompt` (Chrome, Edge, Android): a real button
 *     that opens the browser's own install dialog.
 *   - iOS: there is no install API at all, so the sheet can only teach the
 *     Share → "Add to Home Screen" gesture.
 *   - Anything else (desktop Firefox, an in-app webview): the browser menu is
 *     the only route, so say so rather than showing a button that cannot work.
 */
export function InstallSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { canInstall, isIos, promptInstall } = useInstall();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t('pwa.install_title')} description={t('pwa.install_body')}>
        {canInstall ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={async () => {
                await promptInstall();
                // Closed either way: the browser's own dialog is now the thing
                // being answered, and this sheet behind it is in the way.
                onOpenChange(false);
              }}
            >
              {t('pwa.install_action')}
            </Button>
            <SheetClose asChild>
              <Button variant="quiet">{t('pwa.install_dismiss')}</Button>
            </SheetClose>
          </div>
        ) : isIos ? (
          <ol className="space-y-4">
            <Step icon={<Share className="size-5" />} n={1}>
              {t('pwa.install_ios_step_share')}
            </Step>
            <Step icon={<Plus className="size-5" />} n={2}>
              {t('pwa.install_ios_step_add')}
            </Step>
            <Step icon={<Check className="size-5" />} n={3}>
              {t('pwa.install_ios_step_done')}
            </Step>
          </ol>
        ) : (
          <ol className="space-y-4">
            <Step icon={<MoreVertical className="size-5" />} n={1}>
              {t('pwa.install_manual_step_menu')}
            </Step>
            <Step icon={<Check className="size-5" />} n={2}>
              {t('pwa.install_manual_step_add')}
            </Step>
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** One numbered step. The number is real text rather than a list marker, so it
 *  is announced with the step and cannot be dropped by a styled `<ol>`. */
function Step({ icon, n, children }: { icon: React.ReactNode; n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600"
      >
        {icon}
      </span>
      <p className="pt-1.5">
        <span className="font-semibold">{n}. </span>
        {children}
      </p>
    </li>
  );
}
