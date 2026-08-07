'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle } from 'lucide-react';
import { t } from '@/lib/i18n';
import {
  formatDateLong,
  formatRelative,
  formatTimeRange,
  formatWeekdayLong,
  localDate,
  localTime,
  minutesFromTime,
  timeFromMinutes,
  toInstant,
} from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import { formatIsraeliPhone, telLink, whatsappLink, cn } from '@/lib/utils';
import type { BookingRequestRow, EventRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Field, Input, Textarea } from '@/components/ui/field';
import { TimeRange, Ltr } from '@/components/ui/ltr';

/**
 * §10.7 pending-queue card.
 *
 * Approve is OPTIMISTIC with rollback: the card disappears the moment the admin
 * taps, because G3 wants two taps and a fast one. On ERR_SLOT_CONFLICT it comes
 * back with the conflicting event shown inline and the modified-approval editor
 * offered (FR-21).
 */
const CANNED_REASONS = [
  t('admin.reason.taken'),
  t('admin.reason.hours'),
  t('admin.reason.maintenance'),
  t('admin.reason.other'),
];

export function RequestCard({
  request,
  onResolved,
}: {
  request: BookingRequestRow;
  onResolved: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<EventRow | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [editingTime, setEditingTime] = useState(false);

  const date = localDate(request.requested_start);

  const decide = async (
    path: 'approve' | 'reject',
    body: Record<string, unknown>,
    optimistic: boolean,
  ) => {
    setPending(true);
    setError(null);
    if (optimistic) onResolved(request.id);

    try {
      const response = await fetch(`/api/admin/requests/${request.id}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: request.version, ...body }),
      });

      const payload = (await response.json()) as
        | { event?: EventRow; status?: string }
        | { error: { code: string; message: string } };

      if (!response.ok || 'error' in payload) {
        // Rollback: the card must come back, or the request is silently lost
        // from the queue while still pending.
        if (optimistic) router.refresh();
        const message = 'error' in payload ? payload.error.message : t('error.generic');
        setError(message);
        if ('error' in payload && payload.error.code === 'ERR_SLOT_CONFLICT') {
          await loadConflict();
          setEditingTime(true);
        }
        return;
      }

      onResolved(request.id);
      setRejecting(false);
      router.refresh();
    } catch {
      if (optimistic) router.refresh();
      setError(t('error.generic'));
    } finally {
      setPending(false);
    }
  };

  /** FR-21 / §10.7: show WHICH event is in the way, inline on the card. */
  const loadConflict = async () => {
    try {
      const response = await fetch(
        `/api/availability?start=${encodeURIComponent(request.requested_start)}&end=${encodeURIComponent(request.requested_end)}`,
      );
      if (!response.ok) return;
      const body = (await response.json()) as { conflicts: EventRow[] };
      setConflict(body.conflicts[0] ?? null);
    } catch {
      // The conflict detail is a nicety; the error message already stands alone.
    }
  };

  return (
    <li className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-h3 font-bold">{request.requester_name}</h3>
        <span className="text-xs text-[--ink-muted]">
          {t('admin.submitted', { relative: formatRelative(request.created_at) })}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-[--ink-muted]">{t('event.time')}</dt>
          <dd className="font-semibold">
            {formatWeekdayLong(date)}, {formatDateLong(date)},{' '}
            <TimeRange range={formatTimeRange(request.requested_start, request.requested_end)} />
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-[--ink-muted]">{t('event.type')}</dt>
          <dd className="font-semibold">{usageTypeLabel(request.usage_type)}</dd>
        </div>
        {request.participants ? (
          <div className="flex gap-2">
            <dt className="text-[--ink-muted]">{t('request.field.participants')}</dt>
            <dd className="font-semibold">{request.participants}</dd>
          </div>
        ) : null}
        {request.note ? (
          <div className="flex gap-2">
            <dt className="text-[--ink-muted]">{t('request.field.note')}</dt>
            <dd>{request.note}</dd>
          </div>
        ) : null}
      </dl>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-signal-err">
          {error}
        </p>
      ) : null}

      {conflict ? (
        <p className="mt-2 rounded-[--radius-input] bg-signal-err/10 px-3 py-2 text-sm">
          {t('admin.conflict_with', { title: conflict.title })}{' '}
          <TimeRange range={formatTimeRange(conflict.starts_at, conflict.ends_at)} />
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => decide('approve', {}, true)} disabled={pending}>
          {t('admin.approve')}
        </Button>

        <Button variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>
          {t('admin.reject')}
        </Button>

        <Button variant="ghost" onClick={() => setEditingTime(true)} disabled={pending}>
          {t('admin.approve_modified')}
        </Button>

        {/* §7 PII: the phone is visible here and only here — inside the admin
            area, never on the public schedule. */}
        <a
          href={telLink(request.requester_phone)}
          className="tap-target flex items-center gap-2 rounded-[--radius-input] border border-[--hairline] px-3 text-sm font-semibold"
          aria-label={`${t('trustees.call')} — ${request.requester_name}`}
        >
          <Phone className="size-4" aria-hidden />
          <Ltr>{formatIsraeliPhone(request.requester_phone)}</Ltr>
        </a>

        <a
          href={whatsappLink(request.requester_phone, t('trustees.whatsapp_prefill'))}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target flex items-center justify-center rounded-[--radius-input] border border-[--hairline] px-3"
          aria-label={`${t('trustees.whatsapp')} — ${request.requester_name}`}
        >
          <MessageCircle className="size-4" aria-hidden />
        </a>
      </div>

      <RejectSheet
        open={rejecting}
        onOpenChange={setRejecting}
        pending={pending}
        onReject={(note) => decide('reject', { note }, false)}
      />

      <ModifiedApprovalSheet
        open={editingTime}
        onOpenChange={setEditingTime}
        pending={pending}
        date={date}
        defaultStart={localTime(request.requested_start)}
        defaultEnd={localTime(request.requested_end)}
        onApprove={(start, end, note) =>
          decide('approve', { start, end, note }, false)
        }
      />
    </li>
  );
}

/** FR-22: one-tap canned reasons, plus a free-text note. */
function RejectSheet({
  open,
  onOpenChange,
  pending,
  onReject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onReject: (note: string | undefined) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t('admin.reject')}>
        <div className="flex flex-wrap gap-2">
          {CANNED_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setNote(reason)}
              className={cn(
                'tap-target rounded-[--radius-chip] border px-3 text-sm font-semibold',
                note === reason
                  ? 'border-floodlight bg-floodlight text-pitch-900'
                  : 'border-[--hairline]',
              )}
            >
              {reason}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Field id="reject-note" label={t('admin.note_label')}>
            {(props) => (
              <Textarea
                {...props}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('admin.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => onReject(note.trim() || undefined)}
            disabled={pending}
          >
            {t('admin.reject')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** FR-23: change the time and approve — status becomes `approved_modified`. */
function ModifiedApprovalSheet({
  open,
  onOpenChange,
  pending,
  date,
  defaultStart,
  defaultEnd,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  date: string;
  defaultStart: string;
  defaultEnd: string;
  onApprove: (start: string, end: string, note: string | undefined) => void;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [note, setNote] = useState('');

  const invalid = minutesFromTime(end) <= minutesFromTime(start);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t('admin.approve_modified')} description={formatDateLong(date)}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="modified-start" label={t('request.field.start')} required>
            {(props) => (
              <Input
                type="time"
                step={900}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                {...props}
              />
            )}
          </Field>
          <Field
            id="modified-end"
            label={t('request.field.end')}
            required
            error={invalid ? t('error.ERR_VALIDATION') : undefined}
          >
            {(props) => (
              <Input
                type="time"
                step={900}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                {...props}
              />
            )}
          </Field>
        </div>

        <div className="mt-4">
          <Field id="modified-note" label={t('admin.note_label')}>
            {(props) => (
              <Textarea
                {...props}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('admin.cancel')}
          </Button>
          <Button
            disabled={pending || invalid}
            onClick={() =>
              onApprove(
                // The local wall-clock times are converted with the timezone
                // explicit (§14) — never by adding hours to a string.
                toInstant(date, timeFromMinutes(minutesFromTime(start))).toISOString(),
                toInstant(date, timeFromMinutes(minutesFromTime(end))).toISOString(),
                note.trim() || undefined,
              )
            }
          >
            {t('admin.approve')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
