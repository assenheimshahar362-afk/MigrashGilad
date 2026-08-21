'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { USAGE_TYPES, type EventRow } from '@/lib/types';
import { usageTypeLabel } from '@/lib/usage-type';
import {
  WEEKDAY_NAMES,
  addLocalMonths,
  localDate,
  localTime,
  minutesFromTime,
  toInstant,
  todayLocal,
  weekdayOfLocalDate,
  type LocalDate,
} from '@/lib/time';
import { apiFetch, errorText } from '@/lib/client-api';
import type { EventScope } from '@/lib/event-series';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EventScopeChoice } from '@/components/admin/event-scope-choice';

type RepeatPreset = '3m' | '6m' | '1y' | '2y' | 'none';

/**
 * The date a recurring series is opened up to, expressed the way an admin
 * thinks about it — "a year out" — rather than as a calendar date they have
 * to compute themselves.
 *
 * This is `recurring_rules.valid_until`, not how far ahead occurrences get
 * generated right now: `materialize_recurring` (§ init.sql) only ever
 * materialises 120 days at a time, called here on create and nightly by cron.
 * A "2 years" series does not insert 730 days of events today — it just tells
 * the nightly job not to stop rolling the 120-day window forward until then.
 */
function repeatUntil(date: LocalDate, preset: RepeatPreset): LocalDate | null {
  switch (preset) {
    case '3m':
      return addLocalMonths(date, 3);
    case '6m':
      return addLocalMonths(date, 6);
    case '1y':
      return addLocalMonths(date, 12);
    case '2y':
      return addLocalMonths(date, 24);
    case 'none':
      return null;
  }
}

/**
 * §10.9 admin CRUD. FR-33: this is how fixed community and association hours
 * are entered, bypassing the request flow. FR-34: it is also, now, how a
 * WEEKLY RECURRING series is opened — the "אירוע חוזר" toggle below posts to
 * `/api/admin/recurring` instead of `/api/admin/events`, so there is no
 * separate page for that any more (§10.9 used to have one).
 *
 * The form works in LOCAL wall-clock time and converts once, at submit, through
 * `toInstant` (§14). Nothing here ever adds hours to a string.
 */
export function EventEditor({
  event,
  repeats = false,
  onDone,
}: {
  event?: EventRow;
  /** Whether this occurrence has later ones to carry the edit to (FR-33a) —
   *  a series occurrence, or the same booking typed out week after week. The
   *  caller works it out, because only it has the surrounding weeks. */
  repeats?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<number | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  // Never 'following' by default: see event-scope-choice.tsx on why the
  // reversible option is the one that is pre-selected.
  const [scope, setScope] = useState<EventScope>('single');

  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    usageType: event?.usage_type ?? 'community',
    date: event ? localDate(event.starts_at) : todayLocal(),
    startTime: event ? localTime(event.starts_at) : '17:00',
    endTime: event ? localTime(event.ends_at) : '19:00',
    contactName: event?.contact_name ?? '',
    contactPhone: event?.contact_phone ?? '',
    showContact: event?.show_contact ?? false,
    showNote: event?.show_note ?? false,
    isRecurring: false,
    repeatUntilPreset: '1y' as RepeatPreset,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const invalidTime = minutesFromTime(form.endTime) <= minutesFromTime(form.startTime);

  // An existing event cannot be turned into a series retroactively — it is a
  // different object underneath (a `recurring_rules` row, not an `events`
  // row) with its own edit surface, the list on this same page. The toggle
  // only makes sense while creating something new.
  const recurringAvailable = !event;
  const recurring = recurringAvailable && form.isRecurring;

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (invalidTime) return;

    setPending(true);
    setError(null);
    setGenerated(null);
    setUpdated(null);
    let touched = 1;

    try {
      if (recurring) {
        const result = await apiFetch<{ generated: number }>('/api/admin/recurring', {
          method: 'POST',
          json: {
            title: form.title.trim(),
            usageType: form.usageType,
            weekday: weekdayOfLocalDate(form.date),
            startTime: form.startTime,
            endTime: form.endTime,
            validFrom: form.date,
            validUntil: repeatUntil(form.date, form.repeatUntilPreset),
            isActive: true,
            contactName: form.contactName.trim() || undefined,
          },
        });
        setGenerated(result.generated);
        setForm((current) => ({ ...current, title: '', contactName: '' }));
      } else {
        const body = {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          usageType: form.usageType,
          start: toInstant(form.date, form.startTime).toISOString(),
          end: toInstant(form.date, form.endTime).toISOString(),
          contactName: form.contactName.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          showContact: form.showContact,
        };

        if (event) {
          // `showNote` is on the PATCH schema only — a manual event has no
          // requester note to publish, so `createEventInput` (`.strict()`)
          // rejects the key outright.
          const editBody = { ...body, showNote: form.showNote };
          const result = await apiFetch<{ updated: number }>(`/api/admin/events/${event.id}`, {
            method: 'PATCH',
            json: repeats ? { ...editBody, scope } : editBody,
          });
          // Worth saying out loud only when it reached more than the row the
          // admin was looking at — and when it did, the sheet stays open long
          // enough to read it (see the close below).
          touched = result.updated;
          if (touched > 1) setUpdated(touched);
        } else {
          await apiFetch('/api/admin/events', { method: 'POST', json: body });
        }
      }

      router.refresh();
      // Closing on top of "12 events updated" would hide the only report of
      // what an edit across a whole series actually did.
      if (touched <= 1) onDone?.();
    } catch (thrown) {
      // ERR_SLOT_CONFLICT arrives here from the exclusion constraint (G4) with
      // its Hebrew message already attached.
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="event-title" label={t('calendar.field.title')} required>
        {(props) => (
          <Input
            {...props}
            value={form.title}
            maxLength={120}
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>

      <Field id="event-usage" label={t('event.type')} required>
        {(props) => (
          <Select
            {...props}
            value={form.usageType}
            onChange={(e) => set('usageType', e.target.value as (typeof USAGE_TYPES)[number])}
          >
            {USAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {usageTypeLabel(type)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field id="event-date" label={t('request.field.date')} required>
        {(props) => (
          <Input
            {...props}
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="event-start" label={t('request.field.start')} required>
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
        <Field
          id="event-end"
          label={t('request.field.end')}
          required
          error={invalidTime ? t('error.ERR_VALIDATION') : undefined}
        >
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

      {recurringAvailable ? (
        <div className="rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-(--ink)">
            <input
              type="checkbox"
              className="size-5 accent-(--color-floodlight)"
              checked={form.isRecurring}
              onChange={(e) => set('isRecurring', e.target.checked)}
            />
            {t('calendar.field.recurring')}
          </label>

          {form.isRecurring ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-(--ink-muted)">
                {t('calendar.field.recurring_help', {
                  weekday: WEEKDAY_NAMES[weekdayOfLocalDate(form.date)] ?? '',
                })}
              </p>

              <Field id="event-repeat-until" label={t('calendar.field.repeat_until')} required>
                {(props) => (
                  <Select
                    {...props}
                    value={form.repeatUntilPreset}
                    onChange={(e) => set('repeatUntilPreset', e.target.value as RepeatPreset)}
                  >
                    <option value="3m">{t('calendar.repeat.3m')}</option>
                    <option value="6m">{t('calendar.repeat.6m')}</option>
                    <option value="1y">{t('calendar.repeat.1y')}</option>
                    <option value="2y">{t('calendar.repeat.2y')}</option>
                    <option value="none">{t('calendar.repeat.none')}</option>
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Description, the contact phone and its public visibility all live on
          `events`, not on `recurring_rules` — a series has nowhere to keep
          them. Hidden rather than sent and silently dropped. */}
      {!recurring ? (
        <Field id="event-description" label={t('calendar.field.description')}>
          {(props) => (
            <Textarea
              {...props}
              value={form.description}
              maxLength={1000}
              onChange={(e) => set('description', e.target.value)}
            />
          )}
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="event-contact-name" label={t('calendar.field.contact_name')}>
          {(props) => (
            <Input
              {...props}
              value={form.contactName}
              maxLength={80}
              onChange={(e) => set('contactName', e.target.value)}
            />
          )}
        </Field>
        {!recurring ? (
          <Field id="event-contact-phone" label={t('calendar.field.contact_phone')} hint="05X-XXXXXXX">
            {(props) => (
              <Input
                {...props}
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            )}
          </Field>
        ) : null}
      </div>

      {/* §7 PII: the requester's own note, published ONLY when this is on. The
          note itself is shown above the switch, because "publish it" is not a
          decision anyone can make without seeing the words they are publishing.
          Only an approved request has one, hence the guard. */}
      {event?.requester_note ? (
        <div className="rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) p-3">
          <p className="text-xs font-semibold text-(--ink-faint)">{t('request.field.note')}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-(--ink)">{event.requester_note}</p>
          <label className="mt-3 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-(--color-floodlight)"
              checked={form.showNote}
              onChange={(e) => set('showNote', e.target.checked)}
            />
            {t('calendar.field.show_note')}
          </label>
        </div>
      ) : null}

      {/* §7 PII: the contact phone is shown publicly ONLY when this is on. */}
      {!recurring ? (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-(--color-floodlight)"
            checked={form.showContact}
            onChange={(e) => set('showContact', e.target.checked)}
          />
          {t('calendar.field.show_contact')}
        </label>
      ) : null}

      {/* FR-33a: only for an occurrence that actually has later ones. */}
      {event && repeats ? (
        <EventScopeChoice value={scope} onChange={setScope} disabled={pending} />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      {updated !== null ? (
        <p role="status" className="text-sm font-semibold text-success-ink">
          {t('admin.scope.updated', { count: updated })}
        </p>
      ) : null}

      {generated !== null ? (
        <p role="status" className="text-sm font-semibold text-success-ink">
          {t('recurring.generated', { count: generated })}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || invalidTime}>
          {pending ? t('admin.saving') : t('admin.save')}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
            {t('admin.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
