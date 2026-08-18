'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InstallSheet } from '@/components/pwa/install-sheet';
import { useInstall } from '@/components/pwa/install-context';

/**
 * "Install the app", in the footer's link row — the standing route to
 * installing, as
 * opposed to `<InstallPrompt>`, which offers once on opening and can be waved
 * away. Someone who dismissed that popup and later decided they did want the
 * icon on their home screen has to have somewhere to go.
 *
 * It is here on every browser, whether or not the install event ever fired:
 * the sheet it opens explains the manual route (browser menu, or iOS's Share →
 * "Add to Home Screen") wherever there is no button to press (§
 * install-sheet.tsx). The one case it renders nothing is a session that is
 * already running from the home screen — there, there is genuinely nothing
 * left to install.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, isStandalone, promptInstall } = useInstall();
  const [showSheet, setShowSheet] = useState(false);

  if (isStandalone) return null;

  return (
    <>
      <Button
        // `onField`: the footer is the one dark surface in the product, and the
        // default primary green on `primary-900` is two brand colours fighting.
        variant="onField"
        size="sm"
        // Sized down to sit quietly at the end of the footer's link row:
        // smaller type, tighter sides, a smaller icon, and 36px tall against
        // the row's own 44px. That is under A11Y-1's 44px minimum — asked for
        // deliberately, and it still clears WCAG 2.5.8's 24px — so this is the
        // one control in the product allowed to be smaller than the rule.
        className={cn('min-h-9 gap-1.5 px-2.5 text-[0.6875rem] [&_svg]:size-3.5', className)}
        // With a captured prompt there is nothing to explain — going straight
        // to the browser's own dialog is one tap instead of two. Without one,
        // the sheet is the only thing that can answer "how".
        onClick={() => (canInstall ? promptInstall() : setShowSheet(true))}
      >
        <Download aria-hidden />
        {t('pwa.install_footer')}
      </Button>

      <InstallSheet open={showSheet} onOpenChange={setShowSheet} />
    </>
  );
}
