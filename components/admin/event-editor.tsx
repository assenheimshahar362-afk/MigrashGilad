'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { USAGE_TYPES, type EventRow } from '@/lib/types';
import { usageTypeLabel } from '@/lib/usage-type';
import { localDate, localTime, minutesFromTime, toInstant, todayLocal } from '@/lib/time';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';

/**
 * §10.9 admin CRUD. FR-33: this is how fixed community and association hours
 * are entered, bypassing the request flow.
 *
 * The form works in LOCAL wall-clock time and converts once, at submit, through
 * `toInstant` (§14). Nothing here ever adds hours to a string.
 */
export function EventEditor({
  event,
  onDone,
}: {
  event?: EventRow;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const invalidTime = minutesFromTime(form.endTime) <= minutesFromTime(form.startTime);

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (invalidTime) return;

    setPending(true);
    setError(null);

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

    try {
      if (event) {
        await apiFetch(`/api/admin/events/${event.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch('/api/admin/events', { method: 'POST', json: body });
      }
      router.refresh();
      onDone?.();
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
      </div>

      {/* §7 PII: the contact phone is shown publicly ONLY when this is on. */}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-(--color-floodlight)"
          checked={form.showContact}
          onChange={(e) => set('showContact', e.target.checked)}
        />
        {t('calendar.field.show_contact')}
      </label>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
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
