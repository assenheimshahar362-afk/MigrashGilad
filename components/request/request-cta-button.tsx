'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequestModal } from '@/components/request/request-modal-context';
import { t } from '@/lib/i18n';

/** The hero's primary CTA. Opens the booking modal instead of scrolling to
 *  an in-page section — see `request-modal-context.tsx`. */
export function RequestCtaButton() {
  const { openRequestModal } = useRequestModal();
  return (
    <Button size="lg" onClick={() => openRequestModal()}>
      {t('hero.cta_primary')}
      <ArrowLeft className="size-5" aria-hidden />
    </Button>
  );
}
