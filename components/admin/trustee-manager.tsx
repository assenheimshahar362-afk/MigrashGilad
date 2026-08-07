'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Archive, Star } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { TrusteeRow } from '@/lib/types';
import { apiFetch, errorText } from '@/lib/client-api';
import { cn, formatIsraeliPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Ltr } from '@/components/ui/ltr';

/**
 * FR-31 / §10.9 `/admin/trustees`.
 *
 * Reordering is done with up/down BUTTONS rather than drag. §10.9 requires that
 * drag-reorder always has a non-drag fallback; with a list this short the
 * fallback is simply better than the thing it falls back from — it is keyboard
 * operable for free (A11Y-4) and works one-handed on a phone.
 */
export function TrusteeManager({ trustees }: { trustees: TrusteeRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<TrusteeRow | null>(null);

  const [form, setForm] = useState({ fullName: '', title: '', phone: '' });

  const active = trustees.filter((trustee) => !trustee.is_archived);
  const archived = trustees.filter((trustee) => trustee.is_archived);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/trustees/${id}`, { method: 'PATCH', json: body });
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  /** Swap two neighbours' display_order. Two writes, not a whole re-index. */
  const move = async (index: number, direction: -1 | 1) => {
    const current = active[index];
    const neighbour = active[index + direction];
    if (!current || !neighbour) return;

    setPending(true);
    setError(null);
    try {
      await Promise.all([
        apiFetch(`/api/admin/trustees/${current.id}`, {
          method: 'PATCH',
          json: { displayOrder: neighbour.display_order },
        }),
        apiFetch(`/api/admin/trustees/${neighbour.id}`, {
          method: 'PATCH',
          json: { displayOrder: current.display_order },
        }),
      ]);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiFetch('/api/admin/trustees', {
        method: 'POST',
        json: {
          fullName: form.fullName.trim(),
          title: form.title.trim() || undefined,
          phone: form.phone.trim(),
          displayOrder: active.length + 1,
        },
      });
      setForm({ fullName: '', title: '', phone: '' });
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const archive = async () => {
    if (!archiving) return;
    await patch(archiving.id, { isArchived: true });
    setArchiving(null);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] p-4">
        <h2 className="mb-4 text-h3">{t('trustees.title')}</h2>
        <form onSubmit={create} className="space-y-4">
          <Field id="trustee-name" label={t('request.field.name')} required>
            {(props) => (
              <Input
                {...props}
                value={form.fullName}
                maxLength={80}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              />
            )}
          </Field>
          <Field id="trustee-title" label={t('calendar.field.title')}>
            {(props) => (
              <Input
                {...props}
                value={form.title}
                maxLength={80}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              />
            )}
          </Field>
          <Field id="trustee-phone" label={t('request.field.phone')} required hint="05X-XXXXXXX">
            {(props) => (
              <Input
                {...props}
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              />
            )}
          </Field>

          {error ? (
            <p role="alert" className="text-sm font-semibold text-signal-err">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={pending || form.fullName.trim().length < 2 || form.phone.trim().length < 9}
          >
            {pending ? t('admin.saving') : t('admin.save')}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('managers.active')}</h2>

        {active.length === 0 ? (
          <p className="rounded-[--radius-card] border border-dashed border-[--hairline] p-8 text-center text-[--ink-muted]">
            {t('trustees.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-[--hairline] rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised]">
            {active.map((trustee, index) => (
              <li key={trustee.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {trustee.full_name}
                    {trustee.is_primary ? (
                      <span className="ms-2 text-xs font-bold text-floodlight">
                        {t('trustees.on_duty')}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[--ink-muted]">
                    {trustee.title ? `${trustee.title} · ` : ''}
                    <Ltr>{formatIsraeliPhone(trustee.phone_e164)}</Ltr>
                  </p>
                </div>

                <IconButton
                  label={t('trustees.on_duty')}
                  disabled={pending || trustee.is_primary}
                  onClick={() => patch(trustee.id, { isPrimary: true })}
                  className={trustee.is_primary ? 'text-floodlight' : undefined}
                >
                  <Star className="size-4" aria-hidden />
                </IconButton>

                {/* FR-30: temporarily unavailable greys the public row and hides
                    them from the on-duty slot. */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patch(trustee.id, { isAvailable: !trustee.is_available })}
                  className={cn(
                    'tap-target rounded-[--radius-input] border border-[--hairline] px-3 text-xs font-semibold',
                    !trustee.is_available && 'border-signal-err text-signal-err',
                  )}
                >
                  {trustee.is_available ? t('managers.active') : t('trustees.unavailable')}
                </button>

                <IconButton
                  label={t('schedule.prev_week')}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </IconButton>

                <IconButton
                  label={t('schedule.next_week')}
                  disabled={pending || index === active.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </IconButton>

                <IconButton
                  label={`${t('managers.revoke')} — ${trustee.full_name}`}
                  disabled={pending}
                  onClick={() => setArchiving(trustee)}
                  className="text-signal-err"
                >
                  <Archive className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 ? (
        <section>
          <h2 className="mb-3 text-h3">{t('managers.revoked')}</h2>
          <ul className="divide-y divide-[--hairline] rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised] opacity-70">
            {archived.map((trustee) => (
              <li key={trustee.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate">{trustee.full_name}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => patch(trustee.id, { isArchived: false })}
                >
                  {t('managers.restore')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t('admin.delete_confirm', { name: archiving?.full_name ?? '' })}
        body={t('admin.delete_confirm_body')}
        confirmLabel={t('managers.revoke')}
        pending={pending}
        onConfirm={archive}
      />
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tap-target flex items-center justify-center rounded-[--radius-input] hover:bg-[--surface-sunken] disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}
