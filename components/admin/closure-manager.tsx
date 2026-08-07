'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import {
  addLocalDays,
  formatDateLong,
  formatTimeRange,
  localDate,
  toInstant,
  todayLocal,
} from '@/lib/time';
import type { ClosureRow, EventRow } from '@/lib/types';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TimeRange } from '@/components/ui/ltr';

/**
 * FR-35 / §10.9 `/admin/closures`. Date range, all-day or time range, reason,
 * and whether the closure cancels existing events — WITH A CONFIRMATION LISTING
 * WHAT WILL BE CANCELLED.
 *
 * §14 resolved: there is no automatic Shabbat or chag closure. A holiday
 * closure is entered here by hand like any other, which is why this form has no
 * "holiday" mode and no Hebrew-calendar dependency.
 */
export function ClosureManager({ closures }: { closures: ClosureRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<EventRow[] | null>(null);
  const [deleting, setDeleting] = useState<ClosureRow | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const [form, setForm] = useState({
    reason: '',
    date: addLocalDays(todayLocal(), 1),
    endDate: addLocalDays(todayLocal(), 1),
    allDay: false,
    startTime: '08:00',
    endTime: '14:00',
    cancelConflicts: false,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const range = () => ({
    start: toInstant(form.date, form.allDay ? '00:00' : form.startTime).toISOString(),
    end: form.allDay
      ? toInstant(addLocalDays(form.endDate, 1), '00:00').toISOString()
      : toInstant(form.date, form.endTime).toISOString(),
  });

  const invalid = form.reason.trim().length === 0 || new Date(range().end) <= new Date(range().start);

  /** Ask what would be cancelled BEFORE writing anything. */
  const preview = async () => {
    if (invalid) return;
    setPending(true);
    setError(null);
    try {
      const { start, end } = range();
      const data = await apiFetch<{ conflicts: EventRow[] }>(
        `/api/admin/closures?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      );
      setConflicts(data.conflicts);
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const create = async () => {
    setPending(true);
    setError(null);
    try {
      const { start, end } = range();
      const data = await apiFetch<{ cancelled: number }>('/api/admin/closures', {
        method: 'POST',
        json: {
          reason: form.reason.trim(),
          start,
          end,
          allDay: form.allDay,
          cancelConflicts: form.cancelConflicts,
        },
      });
      setResult(data.cancelled);
      setConflicts(null);
      setForm((current) => ({ ...current, reason: '' }));
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    try {
      await apiFetch(`/api/admin/closures/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="mb-4 text-h3">{t('closures.add')}</h2>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void preview();
          }}
        >
          <Field id="closure-reason" label={t('closures.field.reason')} required>
            {(props) => (
              <Input
                {...props}
                value={form.reason}
                maxLength={200}
                onChange={(e) => set('reason', e.target.value)}
              />
            )}
          </Field>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[--color-floodlight]"
              checked={form.allDay}
              onChange={(e) => set('allDay', e.target.checked)}
            />
            {t('closures.field.all_day')}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="closure-date" label={t('request.field.date')} required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    set('date', e.target.value);
                    if (form.endDate < e.target.value) set('endDate', e.target.value);
                  }}
                />
              )}
            </Field>

            {form.allDay ? (
              <Field id="closure-end-date" label={t('recurring.field.valid_until')} required>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    min={form.date}
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                )}
              </Field>
            ) : null}
          </div>

          {!form.allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id="closure-start" label={t('request.field.start')} required>
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    step={900}
                    value={form.startTime}
                    onChange={(e) => set('startTime', e.target.value)}
                  />
                )}
              </Field>
              <Field id="closure-end" label={t('request.field.end')} required>
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    step={900}
                    value={form.endTime}
                    onChange={(e) => set('endTime', e.target.value)}
                  />
                )}
              </Field>
            </div>
          ) : null}

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[--color-floodlight]"
              checked={form.cancelConflicts}
              onChange={(e) => set('cancelConflicts', e.target.checked)}
            />
            {t('closures.field.cancel_conflicts')}
          </label>

          {error ? (
            <p role="alert" className="text-sm font-semibold text-signal-err">
              {error}
            </p>
          ) : null}

          {result !== null ? (
            <p role="status" className="text-sm font-semibold text-signal-ok">
              {t('closures.cancelled_count', { count: result })}
            </p>
          ) : null}

          <Button type="submit" disabled={pending || invalid}>
            {t('closures.add')}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('closures.title')}</h2>

        {closures.length === 0 ? (
          <p className="rounded-[--radius-card] border border-dashed border-[--hairline] p-8 text-center text-[--ink-muted]">
            {t('admin.empty_generic')}
          </p>
        ) : (
          <ul className="divide-y divide-[--hairline] rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised]">
            {closures.map((closure) => (
              <li key={closure.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{closure.reason}</p>
                  <p className="text-xs text-[--ink-muted]">
                    {formatDateLong(localDate(closure.starts_at))}
                    {closure.all_day ? (
                      ` · ${t('closures.field.all_day')}`
                    ) : (
                      <>
                        {' · '}
                        <TimeRange range={formatTimeRange(closure.starts_at, closure.ends_at)} />
                      </>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleting(closure)}
                  aria-label={`${t('admin.delete_event')} — ${closure.reason}`}
                  className="tap-target flex items-center justify-center rounded-[--radius-input] text-signal-err hover:bg-[--surface-sunken]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FR-35: the confirmation LISTS what will be cancelled. */}
      <ConfirmDialog
        open={conflicts !== null}
        onOpenChange={(open) => !open && setConflicts(null)}
        title={form.reason || t('closures.add')}
        destructive={form.cancelConflicts && (conflicts?.length ?? 0) > 0}
        confirmLabel={t('closures.add')}
        pending={pending}
        onConfirm={create}
      >
        {conflicts && conflicts.length > 0 ? (
          <>
            <p className="text-sm font-semibold">
              {form.cancelConflicts
                ? t('closures.conflicts_title')
                : t('admin.conflict_with', { title: '' })}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {conflicts.map((event) => (
                <li key={event.id} className="flex gap-2">
                  <TimeRange range={formatTimeRange(event.starts_at, event.ends_at)} />
                  <span className="font-semibold">{event.title}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-[--ink-muted]">{t('schedule.empty')}</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('admin.delete_confirm', { name: deleting?.reason ?? '' })}
        body={t('admin.delete_confirm_body')}
        confirmLabel={t('admin.delete_event')}
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
