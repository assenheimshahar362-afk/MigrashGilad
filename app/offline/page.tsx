import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: t('offline.title') };

/**
 * §12 offline shell. The service worker serves this for a navigation it cannot
 * fulfil. It explains what IS available offline rather than only reporting the
 * failure — the cached schedule is one tap away and is usually what the visitor
 * came for.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center px-6 text-center">
      <WifiOff className="size-12 text-stone-500" aria-hidden />
      <h1 className="mt-4 text-h1">{t('offline.title')}</h1>
      <p className="mt-3 text-[--ink-muted]">{t('offline.body')}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">{t('common.back_home')}</Link>
        </Button>
      </div>
    </div>
  );
}
