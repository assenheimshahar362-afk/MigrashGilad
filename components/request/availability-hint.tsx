'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, TriangleAlert, Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { toInstant } from '@/lib/time';
import { cn } from '@/lib/utils';

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken'; closed: boolean };

/**
 * FR-13: a live availability check before submit, which WARNS and does not
 * block. The wording is deliberate — "המועד תפוס — אפשר בכל זאת להגיש בקשה" —
 * because an admin may still want to see the request.
 *
 * The result is announced politely (A11Y-7): it changes while the visitor is
 * still filling the form, and an assertive region would interrupt them.
 */
export function AvailabilityHint({
  date,
  startTime,
  endTime,
}: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (!date || !startTime || !endTime || endTime <= startTime) {
      setState({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    // Debounced: the time inputs fire on every keystroke on desktop.
    const timer = setTimeout(async () => {
      setState({ kind: 'checking' });
      try {
        const start = toInstant(date, startTime).toISOString();
        const end = toInstant(date, endTime).toISOString();
        const response = await fetch(
          `/api/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setState({ kind: 'idle' });
          return;
        }
        const body = (await response.json()) as { available: boolean; closed: boolean };
        setState(body.available ? { kind: 'available' } : { kind: 'taken', closed: body.closed });
      } catch {
        // Offline, or the check was superseded. The form still submits; the
        // server is the authority on availability anyway.
        setState({ kind: 'idle' });
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [date, startTime, endTime]);

  if (state.kind === 'idle') return <div aria-live="polite" className="min-h-6" />;

  return (
    <p
      aria-live="polite"
      className={cn(
        'flex min-h-6 items-center gap-2 text-sm font-semibold',
        state.kind === 'available' && 'text-signal-ok',
        state.kind === 'taken' && 'text-signal-err',
        state.kind === 'checking' && 'text-[--ink-muted]',
      )}
    >
      {state.kind === 'checking' ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('request.checking')}
        </>
      ) : state.kind === 'available' ? (
        <>
          <CircleCheck className="size-4" aria-hidden />
          {t('request.available')}
        </>
      ) : (
        <>
          <TriangleAlert className="size-4" aria-hidden />
          {state.closed ? t('error.ERR_CLOSED') : t('request.taken')}
        </>
      )}
    </p>
  );
}
