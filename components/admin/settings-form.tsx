'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { WEEKDAY_NAMES } from '@/lib/time';
import type { OpeningHours, SiteSettingsRow } from '@/lib/types';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';

/**
 * §10.9 `/admin/settings` — super admin only (FR-37).
 *
 * FR-37a: opening hours are settable PER DAY with different values per day, and
 * any day may be set to closed all day. All seven rows are rendered by the same
 * loop over WEEKDAY_NAMES — Friday and Saturday have no special case here, in
 * the validator, or in the trigger behind it.
 */
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function SettingsForm({ settings }: { settings: SiteSettingsRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [maintenance, setMaintenance] = useState<{ action: string; affected: number } | null>(null);

  const [hours, setHours] = useState<OpeningHours>(settings.opening_hours);
  const [form, setForm] = useState({
    pitchName: settings.pitch_name,
    minLeadHours: settings.min_lead_hours,
    maxHorizonDays: settings.max_horizon_days,
    maxDurationMin: settings.max_duration_min,
    requestsOpen: settings.requests_open,
    requestsClosedMsg: settings.requests_closed_msg ?? '',
    memorialHtml: settings.memorial_html ?? '',
    memorialDays: (settings.memorial_days ?? []).join(', '),
  });

  const setDay = (day: number, value: [string, string] | null) =>
    setHours((current) => ({ ...current, [String(day)]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        json: {
          pitchName: form.pitchName.trim(),
          openingHours: hours,
          minLeadHours: Number(form.minLeadHours),
          maxHorizonDays: Number(form.maxHorizonDays),
          maxDurationMin: Number(form.maxDurationMin),
          requestsOpen: form.requestsOpen,
          requestsClosedMsg: form.requestsClosedMsg.trim() || null,
          memorialHtml: form.memorialHtml.trim() || null,
          memorialDays: form.memorialDays
            .split(',')
            .map((value) => value.trim())
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
        },
      });
      setSaved(true);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  /** FR-37b: each maintenance action SHOWS WHAT IT WILL AFFECT before running. */
  const runMaintenance = async (action: 'materialize' | 'expire' | 'anonymise', dryRun: boolean) => {
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<{ affected: number }>('/api/admin/maintenance', {
        method: 'POST',
        json: { action, dryRun },
      });
      setMaintenance({ action, affected: result.affected });
      if (!dryRun) router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="mb-2 text-h3">{t('settings.opening_hours')}</h2>
        <p className="mb-4 text-sm text-[--ink-muted]">{t('settings.opening_hours_help')}</p>

        <ul className="space-y-3">
          {DAYS.map((day) => {
            const value = hours[String(day)] ?? null;
            const closed = value === null;

            return (
              <li key={day} className="flex flex-wrap items-center gap-3">
                <span className="w-24 shrink-0 font-semibold">{WEEKDAY_NAMES[day]}</span>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-[--color-floodlight]"
                    checked={closed}
                    onChange={(e) => setDay(day, e.target.checked ? null : ['06:00', '23:00'])}
                  />
                  {t('settings.day_closed')}
                </label>

                {!closed ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      aria-label={`${WEEKDAY_NAMES[day]} — ${t('request.field.start')}`}
                      value={value[0]}
                      onChange={(e) => setDay(day, [e.target.value, value[1]])}
                      className="min-h-11 rounded-[--radius-input] border border-[--hairline] bg-[--surface-raised] px-2"
                    />
                    <span aria-hidden>–</span>
                    <input
                      type="time"
                      step={900}
                      aria-label={`${WEEKDAY_NAMES[day]} — ${t('request.field.end')}`}
                      value={value[1]}
                      onChange={(e) => setDay(day, [value[0], e.target.value])}
                      className="min-h-11 rounded-[--radius-input] border border-[--hairline] bg-[--surface-raised] px-2"
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-4 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4 sm:grid-cols-3">
        <Field id="min-lead" label={t('settings.min_lead_hours')} required>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              max={720}
              value={form.minLeadHours}
              onChange={(e) => setForm((c) => ({ ...c, minLeadHours: Number(e.target.value) }))}
            />
          )}
        </Field>

        <Field id="max-horizon" label={t('settings.max_horizon_days')} required>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={730}
              value={form.maxHorizonDays}
              onChange={(e) => setForm((c) => ({ ...c, maxHorizonDays: Number(e.target.value) }))}
            />
          )}
        </Field>

        <Field id="max-duration" label={t('settings.max_duration_min')} required>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={15}
              max={360}
              step={15}
              value={form.maxDurationMin}
              onChange={(e) => setForm((c) => ({ ...c, maxDurationMin: Number(e.target.value) }))}
            />
          )}
        </Field>
      </section>

      <section className="space-y-4 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <label className="flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-[--color-floodlight]"
            checked={form.requestsOpen}
            onChange={(e) => setForm((c) => ({ ...c, requestsOpen: e.target.checked }))}
          />
          {t('settings.requests_open')}
        </label>

        {/* FR-37: the public banner reason shown while requests are paused. */}
        {!form.requestsOpen ? (
          <Field id="closed-msg" label={t('settings.requests_closed_msg')}>
            {(props) => (
              <Textarea
                {...props}
                value={form.requestsClosedMsg}
                maxLength={300}
                onChange={(e) => setForm((c) => ({ ...c, requestsClosedMsg: e.target.value }))}
              />
            )}
          </Field>
        ) : null}

        <Field id="pitch-name" label={t('app.name')} required>
          {(props) => (
            <Input
              {...props}
              value={form.pitchName}
              maxLength={80}
              onChange={(e) => setForm((c) => ({ ...c, pitchName: e.target.value }))}
            />
          )}
        </Field>
      </section>

      <section className="space-y-4 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="text-h3">{t('memorial.title')}</h2>

        {/* §7: this HTML is sanitised on the server before storage and again at
            render. What is typed here is never trusted. */}
        <Field id="memorial-html" label={t('settings.memorial_html')}>
          {(props) => (
            <Textarea
              {...props}
              rows={10}
              value={form.memorialHtml}
              maxLength={50_000}
              onChange={(e) => setForm((c) => ({ ...c, memorialHtml: e.target.value }))}
            />
          )}
        </Field>

        {/* FR-40: memorial days are stored per-year, never computed (§14). */}
        <Field
          id="memorial-days"
          label={t('settings.memorial_days')}
          hint="YYYY-MM-DD, YYYY-MM-DD"
        >
          {(props) => (
            <Input
              {...props}
              dir="ltr"
              value={form.memorialDays}
              onChange={(e) => setForm((c) => ({ ...c, memorialDays: e.target.value }))}
            />
          )}
        </Field>
      </section>

      <section className="space-y-3 rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="text-h3">{t('settings.maintenance')}</h2>

        {maintenance ? (
          <p role="status" className="text-sm font-semibold">
            {t('settings.maintenance.affected', { count: maintenance.affected })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['materialize', t('settings.maintenance.materialize')],
              ['expire', t('settings.maintenance.expire')],
              ['anonymise', t('settings.maintenance.anonymise')],
            ] as const
          ).map(([action, label]) => (
            <span key={action} className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => runMaintenance(action, true)}
              >
                {label}
              </Button>
              {maintenance?.action === action ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => runMaintenance(action, false)}
                >
                  {t('settings.maintenance.run')}
                </Button>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-[--radius-input] border-2 border-signal-err bg-signal-err/10 px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}

      {saved ? (
        <p role="status" className="text-sm font-semibold text-signal-ok">
          {t('admin.saved')}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t('admin.saving') : t('admin.save')}
      </Button>
    </form>
  );
}
