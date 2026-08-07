'use client';

import { useEffect } from 'react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/**
 * NFR-4: no stack traces reach the client. Next.js already redacts the message
 * in production; what is shown here is a Hebrew sentence and a retry, plus the
 * digest so a report can be tied to the server-side log entry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-h1">{t('error.title')}</h1>
      <p className="mt-3 text-[--ink-muted]">{t('error.generic')}</p>

      {error.digest ? (
        <p className="mt-2 text-xs text-[--ink-muted]">
          <bdi dir="ltr">{error.digest}</bdi>
        </p>
      ) : null}

      <Button className="mt-6" onClick={reset}>
        {t('common.retry')}
      </Button>
    </main>
  );
}
