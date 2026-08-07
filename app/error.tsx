'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
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
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger-ink"
      >
        <TriangleAlert className="size-8" />
      </span>

      <h1 className="mt-5 text-h1">{t('error.title')}</h1>
      <p className="mt-3 max-w-[38ch] text-(--ink-muted)">{t('error.generic')}</p>

      {/* The digest is the only thing here that ties a visitor's report to a
          server log line, so it is selectable and monospaced-by-figures rather
          than hidden away. */}
      {error.digest ? (
        <p className="tnum mt-3 rounded-(--radius-chip) bg-(--surface-sunken) px-2.5 py-1 text-xs text-(--ink-faint) select-all">
          <bdi dir="ltr">{error.digest}</bdi>
        </p>
      ) : null}

      <Button className="mt-7" onClick={reset}>
        {t('common.retry')}
      </Button>
    </main>
  );
}
