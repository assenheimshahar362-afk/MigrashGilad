'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import { apiFetch, errorText } from '@/lib/client-api';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function SettingsForm({
  openingTime,
  closingTime,
}: {
  openingTime: string;
  closingTime: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ openingTime, closingTime });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const rangeValid = form.closingTime > form.openingTime;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rangeValid) return;

    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch('/api/admin/settings', { method: 'PATCH', json: form });
      setSaved(true);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card max-w-xl p-4 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <Clock3 className="size-5 text-primary-600" aria-hidden />
        <h2 className="text-h3">{t('settings.opening_hours')}</h2>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="opening-time" label={t('settings.opening_time')} required>
            {(props) => (
              <Input
                {...props}
                type="time"
                dir="ltr"
                required
                value={form.openingTime}
                onChange={(event) =>
                  setForm((current) => ({ ...current, openingTime: event.target.value }))
                }
              />
            )}
          </Field>

          <Field
            id="closing-time"
            label={t('settings.closing_time')}
            required
            error={!rangeValid ? t('settings.invalid_range') : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="time"
                dir="ltr"
                required
                value={form.closingTime}
                onChange={(event) =>
                  setForm((current) => ({ ...current, closingTime: event.target.value }))
                }
              />
            )}
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm font-semibold text-success-ink">
            {t('settings.saved')}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || !rangeValid}>
          {pending ? t('admin.saving') : t('admin.save')}
        </Button>
      </form>
    </section>
  );
}