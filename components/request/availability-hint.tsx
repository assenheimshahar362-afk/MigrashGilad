'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleCheck, TriangleAlert, Loader2, Ban } from 'lucide-react';
import { t } from '@/lib/i18n';
import { toInstant } from '@/lib/time';
import { cn } from '@/lib/utils';

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'blocked'; reason: 'association' | 'taken' };

/**
 * FR-13: a live availability check before submit, which WARNS and does not
 * block. The wording is deliberate — "המועד תפוס — אפשר בכל זאת להגיש בקשה" —
 * because an admin may still want to see the request.
 *
 * Time that is not free community time is the exception, and the only state
 * here that is not a warning: `POST /api/requests` refuses it, so
 * `onBlockedChange` tells the form to hold the visitor on this step rather
 * than letting them fill in two more screens for a request that cannot be
 * sent. A failed check reports `false` — the server is the authority, and a
 * network blip must not lock the form.
 *
 * The result is announced politely (A11Y-7): it changes while the visitor is
 * still filling the form, and an assertive region would interrupt them.
 */
export function AvailabilityHint({
  date,
  startTime,
  endTime,
  onBlockedChange,
}: {
  date: string;
  startTime: string;
  endTime: string;
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  // Kept in a ref rather than in the effect's dependencies, so a caller that
  // rebuilds the callback on every render cannot restart the check: the only
  // things that should trigger a fetch are the three times.
  const notifyBlocked = useRef(onBlockedChange);
  useEffect(() => {
    notifyBlocked.current = onBlockedChange;
  }, [onBlockedChange]);

  useEffect(() => {
    const settle = (next: State) => {
      setState(next);
      notifyBlocked.current?.(next.kind === 'blocked');
    };

    if (!date || !startTime || !endTime || endTime <= startTime) {
      settle({ kind: 'idle' });
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
          settle({ kind: 'idle' });
          return;
        }
        const body = (await response.json()) as {
          available: boolean;
          blocked?: boolean;
          blockedReason?: 'association' | 'taken' | null;
        };
        // `blocked` is checked first: a blocked slot is also a conflict,
        // and "you cannot request this" is the more useful of the two answers.
        settle(
          body.blocked
            ? { kind: 'blocked', reason: body.blockedReason ?? 'taken' }
            : body.available
              ? { kind: 'available' }
              : { kind: 'taken' },
        );
      } catch {
        // Offline, or the check was superseded. The form still submits; the
        // server is the authority on availability anyway.
        settle({ kind: 'idle' });
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [date, startTime, endTime]);

  if (state.kind === 'idle') return <div aria-live="polite" className="min-h-6" />;

  // A refusal, not a warning — so it is a panel with a border rather than one
  // more line of status text, matching how the form shows a rejected submit.
  if (state.kind === 'blocked') {
    return (
      <p
        aria-live="polite"
        className={cn(
          'animate-rise-in flex items-start gap-2 rounded-(--radius-input)',
          'border border-danger/40 bg-danger/8 px-4 py-3 text-sm font-semibold text-danger-ink',
        )}
      >
        <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t(state.reason === 'association' ? 'request.association_blocked' : 'request.taken_blocked')}
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        'flex min-h-6 items-center gap-2 text-sm font-semibold',
        // The `-ink` steps, not the raw signal colours: #22c55e as text on
        // white is 2.27:1. The bright ones are fills — dots, bars, borders —
        // and never carry a sentence.
        state.kind === 'available' && 'text-success-ink',
        state.kind === 'taken' && 'text-danger-ink',
        state.kind === 'checking' && 'text-(--ink-muted)',
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
          {t('request.taken')}
        </>
      )}
    </p>
  );
}
