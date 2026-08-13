'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Archive, ImageOff, ImagePlus, Pencil } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { TrusteeRow } from '@/lib/types';
import { apiFetch, apiUpload, errorText } from '@/lib/client-api';
import { cn, formatIsraeliPhone, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip } from '@/components/ui/tooltip';
import { Ltr } from '@/components/ui/ltr';

/**
 * FR-31 / §10.9 `/admin/trustees`. New trustees are appended in creation
 * order — there is deliberately no manual reordering, no "on duty" slot and
 * no active/inactive toggle here; the list is just who is a trustee and who
 * isn't.
 */
export function TrusteeManager({ trustees }: { trustees: TrusteeRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<TrusteeRow | null>(null);
  const [editing, setEditing] = useState<TrusteeRow | null>(null);

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

  const uploadPhoto = async (id: string, file: File) => {
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiUpload(`/api/admin/trustees/${id}/photo`, formData);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const removePhoto = async (id: string) => {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/trustees/${id}/photo`, { method: 'DELETE' });
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="card p-4">
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
            <p role="alert" className="text-sm font-semibold text-danger-ink">
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
          <p className="empty-state">
            {t('trustees.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-(--hairline) card">
            {active.map((trustee) => (
              <li key={trustee.id} className="flex flex-wrap items-center gap-2 p-3">
                {trustee.photo_url ? (
                  <Image
                    src={trustee.photo_url}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700"
                  >
                    {initials(trustee.full_name)}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{trustee.full_name}</p>
                  <p className="text-xs text-(--ink-muted)">
                    {trustee.title ? `${trustee.title} · ` : ''}
                    <Ltr>{formatIsraeliPhone(trustee.phone_e164)}</Ltr>
                  </p>
                </div>

                {/* The label IS the tap target — a real file input can't be
                    styled, so it's visually hidden and triggered by its
                    label instead, which keeps it keyboard- and
                    screen-reader-operable for free. */}
                <input
                  id={`trustee-photo-${trustee.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={pending}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadPhoto(trustee.id, file);
                  }}
                />
                <Tooltip content={t('trustees.photo_upload')}>
                  <label
                    htmlFor={`trustee-photo-${trustee.id}`}
                    aria-label={`${t('trustees.photo_upload')} — ${trustee.full_name}`}
                    className={cn(
                      'tap-target flex items-center justify-center rounded-(--radius-input) hover:bg-(--surface-sunken)',
                      pending && 'pointer-events-none opacity-40',
                    )}
                  >
                    <ImagePlus className="size-4" aria-hidden />
                  </label>
                </Tooltip>

                {trustee.photo_url ? (
                  <IconButton
                    label={`${t('trustees.photo_remove')} — ${trustee.full_name}`}
                    disabled={pending}
                    onClick={() => removePhoto(trustee.id)}
                  >
                    <ImageOff className="size-4" aria-hidden />
                  </IconButton>
                ) : null}

                <IconButton
                  label={`${t('trustees.edit')} — ${trustee.full_name}`}
                  disabled={pending}
                  onClick={() => setEditing(trustee)}
                >
                  <Pencil className="size-4" aria-hidden />
                </IconButton>

                <IconButton
                  label={`${t('trustees.archive')} — ${trustee.full_name}`}
                  disabled={pending}
                  onClick={() => setArchiving(trustee)}
                  className="text-danger-ink"
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
          <h2 className="mb-3 text-h3">{t('trustees.removed')}</h2>
          <ul className="divide-y divide-(--hairline) card opacity-70">
            {archived.map((trustee) => (
              <li key={trustee.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate">{trustee.full_name}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => patch(trustee.id, { isArchived: false })}
                >
                  {t('trustees.restore')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t('trustees.archive_confirm_title', { name: archiving?.full_name ?? '' })}
        body={t('trustees.archive_confirm_body')}
        confirmLabel={t('trustees.archive')}
        pending={pending}
        onConfirm={archive}
      />

      <EditTrusteeSheet
        trustee={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={patch}
        pending={pending}
      />
    </div>
  );
}

/**
 * Every instance is icon-only, so `label` does double duty: the accessible
 * name (A11Y-2) AND, via `Tooltip`, the sighted-but-unsure answer to "what
 * does this button do" — the same text, on hover and on keyboard focus.
 */
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
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'tap-target flex items-center justify-center rounded-(--radius-input) hover:bg-(--surface-sunken) disabled:opacity-40',
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * FR-31 extension: editing a trustee's own fields (name, role title, phone,
 * WhatsApp visibility) used to have no UI at all — only reordering,
 * on-duty/availability toggles and archiving did. The form re-seeds from
 * `trustee` in an effect keyed on its identity, not on every render, so
 * typing isn't fought by a prop that hasn't changed.
 */
function EditTrusteeSheet({
  trustee,
  onOpenChange,
  onSave,
  pending,
}: {
  trustee: TrusteeRow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState({ fullName: '', title: '', phone: '', whatsappOk: true });

  useEffect(() => {
    if (!trustee) return;
    setForm({
      fullName: trustee.full_name,
      title: trustee.title ?? '',
      phone: trustee.phone_e164,
      whatsappOk: trustee.whatsapp_ok,
    });
  }, [trustee]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trustee) return;
    await onSave(trustee.id, {
      fullName: form.fullName.trim(),
      title: form.title.trim() || undefined,
      phone: form.phone.trim(),
      whatsappOk: form.whatsappOk,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={Boolean(trustee)} onOpenChange={onOpenChange}>
      <SheetContent title={t('trustees.edit_title')} description={trustee?.full_name}>
        <form onSubmit={submit} className="space-y-4">
          <Field id="trustee-edit-name" label={t('request.field.name')} required>
            {(props) => (
              <Input
                {...props}
                value={form.fullName}
                maxLength={80}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              />
            )}
          </Field>
          <Field id="trustee-edit-title" label={t('calendar.field.title')}>
            {(props) => (
              <Input
                {...props}
                value={form.title}
                maxLength={80}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              />
            )}
          </Field>
          <Field id="trustee-edit-phone" label={t('request.field.phone')} required hint="05X-XXXXXXX">
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

          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-(--ink)">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={form.whatsappOk}
              onChange={(e) => setForm((c) => ({ ...c, whatsappOk: e.target.checked }))}
            />
            {t('trustees.whatsapp_ok_field')}
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t('admin.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={pending || form.fullName.trim().length < 2 || form.phone.trim().length < 9}
            >
              {pending ? t('admin.saving') : t('admin.save')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
