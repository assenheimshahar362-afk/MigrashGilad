'use client';

import { useState } from 'react';
import { Download, Share, Plus, Check } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useInstall } from '@/components/pwa/install-context';

/**
 * "Install the app", in the footer — the deliberate, always-available route to
 * installing, as opposed to `<InstallPrompt>`, which interrupts once and can
 * be dismissed forever. Someone who waved that banner away and later decided
 * they did want the icon on their home screen previously had nowhere to go.
 *
 * It renders NOTHING when there is nothing to do — already installed, or a
 * browser that neither fires the install event nor is iOS (desktop Firefox,
 * say). A button that opens a dialog saying "not supported here" is worse than
 * no button: it takes up the same room and answers a question nobody asked.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, isStandalone, isIos, promptInstall } = useInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (isStandalone || (!canInstall && !isIos)) return null;

  return (
    <>
      <Button
        // `onField`: the footer is the one dark surface in the product, and the
        // default primary green on `primary-900` is two brand colours fighting.
        variant="onField"
        size="sm"
        className={cn('gap-2', className)}
        onClick={() => (canInstall ? promptInstall() : setShowIosSteps(true))}
      >
        <Download className="size-4" aria-hidden />
        {t('pwa.install_footer')}
      </Button>

      {/* iOS has no install API at all, so there the button can only teach the
          gesture. Three steps in the same sheet every other dialog uses. */}
      <Sheet open={showIosSteps} onOpenChange={setShowIosSteps}>
        <SheetContent title={t('pwa.install_title')} description={t('pwa.install_body')}>
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
        </SheetContent>
      </Sheet>
    </>
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
