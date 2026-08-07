'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { WEEKDAY_NAMES, todayLocal } from '@/lib/time';
import { USAGE_TYPES, type RecurringRuleRow, type UsageType } from '@/lib/types';
import { usageTypeLabel } from '@/lib/usage-type';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * FR-34 / §10.9 `/admin/recurring`.
 *
 * The weekday list is `WEEKDAY_NAMES` in full, all seven entries. Friday and
 * Saturday are ordinary options here — a rule for weekday 5 materialises for
 * 120 days with no gaps (scenario 19).
 */
export function RecurringManager({ rules }: { rules: RecurringRuleRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<RecurringRuleRow | null>(null);

  const [form, setForm] = useState({
    title: '',
    usageType: 'association' as UsageType,
    weekday: 2,
    startTime: '17:00',
    endTime: '19:00',
    validFrom: todayLocal(),
    validUntil: '',
    contactName: '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const invalid = form.endTime <= form.startTime || form.title.trim().length === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;

    setPending(true);
    setError(null);
    setGenerated(null);

    try {
      const result = await apiFetch<{ generated: number }>('/api/admin/recurring', {
        method: 'POST',
        json: {
          title: form.title.trim(),
          usageType: form.usageType,
          weekday: form.weekday,
          startTime: form.startTime,
          endTime: form.endTime,
          validFrom: form.validFrom,
          validUntil: form.validUntil || null,
          isActive: true,
          contactName: form.contactName.trim() || undefined,
        },
      });
      setGenerated(result.generated);
      setForm((current) => ({ ...current, title: '', contactName: '' }));
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
      await apiFetch(`/api/admin/recurring/${deleting.id}`, { method: 'DELETE' });
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
        <h2 className="mb-4 text-h3">{t('recurring.add')}</h2>

        <form onSubmit={submit} className="space-y-4">
          <Field id="rule-title" label={t('calendar.field.title')} required>
            {(props) => (
              <Input
                {...props}
                value={form.title}
                maxLength={120}
                onChange={(e) => set('title', e.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="rule-usage" label={t('event.type')} required>
              {(props) => (
                <Select
                  {...props}
                  value={form.usageType}
                  onChange={(e) => set('usageType', e.target.value as UsageType)}
                >
                  {USAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {usageTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="rule-weekday" label={t('recurring.field.weekday')} required>
              {(props) => (
                <Select
                  {...props}
                  value={form.weekday}
                  onChange={(e) => set('weekday', Number(e.target.value))}
                >
                  {WEEKDAY_NAMES.map((name, day) => (
                    <option key={name} value={day}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="rule-start" label={t('request.field.start')} required>
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
            <Field id="rule-end" label={t('request.field.end')} required>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="rule-from" label={t('recurring.field.valid_from')} required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => set('validFrom', e.target.value)}
                />
              )}
            </Field>
            <Field id="rule-until" label={t('recurring.field.valid_until')}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => set('validUntil', e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field id="rule-contact" label={t('calendar.field.contact_name')}>
            {(props) => (
              <Input
                {...props}
                value={form.contactName}
                maxLength={80}
                onChange={(e) => set('contactName', e.target.value)}
              />
            )}
          </Field>

          {error ? (
            <p role="alert" className="text-sm font-semibold text-signal-err">
              {error}
            </p>
          ) : null}

          {generated !== null ? (
            <p role="status" className="text-sm font-semibold text-signal-ok">
              {t('recurring.generated', { count: generated })}
            </p>
          ) : null}

          <Button type="submit" disabled={pending || invalid}>
            {pending ? t('admin.saving') : t('admin.save')}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('recurring.title')}</h2>

        {rules.length === 0 ? (
          <p className="rounded-[--radius-card] border border-dashed border-[--hairline] p-8 text-center text-[--ink-muted]">
            {t('admin.empty_generic')}
          </p>
        ) : (
          <ul className="divide-y divide-[--hairline] rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised]">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{rule.title}</p>
                  <p className="text-xs text-[--ink-muted]">
                    {WEEKDAY_NAMES[rule.weekday]} ·{' '}
                    <bdi dir="ltr" className="tnum">
                      {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
                    </bdi>{' '}
                    · {usageTypeLabel(rule.usage_type)}
                    {rule.is_active ? '' : ` · ${t('recurring.field.active')}: ✕`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleting(rule)}
                  aria-label={`${t('admin.delete_event')} — ${rule.title}`}
                  className="tap-target flex items-center justify-center rounded-[--radius-input] text-signal-err hover:bg-[--surface-sunken]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('admin.delete_confirm', { name: deleting?.title ?? '' })}
        body={t('admin.delete_confirm_body')}
        confirmLabel={t('admin.delete_event')}
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
