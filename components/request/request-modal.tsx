'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RequestForm } from '@/components/request/request-form';
import { useRequestModal } from '@/components/request/request-modal-context';
import { t } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/types';

/**
 * §10.3 / FR-11, now a floating dialog rather than a page section. Mounted
 * once in the public layout (above the header/footer/tab-bar that trigger
 * it) so there is exactly one instance no matter which affordance opened it.
 *
 * Sheet already carries the right motion for this: a bottom drawer on
 * mobile, a centred dialog scaling from 0.96 on desktop (`components/ui/
 * sheet.tsx`) — the same primitive used for every other modal in the app,
 * so the booking flow doesn't introduce a second dialog language.
 */
export function RequestModal({ settings }: { settings: PublicSettings }) {
  const { isOpen, prefill, closeRequestModal } = useRequestModal();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeRequestModal()}>
      <SheetContent title={t('request.title')} description={t('app.tagline')}>
        {settings.requestsOpen ? (
          <RequestForm settings={settings} prefill={prefill} />
        ) : (
          <p className="rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) p-4 text-(--ink-muted)">
            {settings.requestsClosedMsg ?? t('error.ERR_REQUESTS_CLOSED')}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
