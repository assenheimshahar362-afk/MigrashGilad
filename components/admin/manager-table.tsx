'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import type { Manager } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * §10.8 `/admin/managers` — super admin only.
 *
 * FR-36a: the screen must REFUSE, with a clear Hebrew message, any action that
 * would leave zero active super admins or let the signed-in super admin revoke
 * or demote their own row.
 *
 * The self-row's controls are DISABLED with a tooltip rather than left enabled
 * to fail — §10.8 is explicit that the failure should be prevented rather than
 * explained after the fact. But the server errors still render as inline Hebrew
 * (below): the UI guard is convenience, the database is the authority. That is
 * why `ERR_LAST_SUPER_ADMIN` has a rendering path at all — the UI cannot know
 * whether another super admin was revoked in a different tab a second ago.
 */
type PendingAction =
  | { kind: 'promote' | 'demote' | 'revoke' | 'restore'; manager: Manager }
  | null;

export function ManagerTable({ managers }: { managers: Manager[] }) {
  const router = useRouter();
  const [action, setAction] = useState<PendingAction>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'admin' as const });

  const run = async () => {
    if (!action) return;
    setPending(true);
    setError(null);

    const body =
      action.kind === 'promote'
        ? { role: 'super_admin' }
        : action.kind === 'demote'
          ? { role: 'admin' }
          : action.kind === 'revoke'
            ? { revoke: true }
            : { revoke: false };

    try {
      await apiFetch(`/api/admin/managers/${action.manager.id}`, { method: 'PATCH', json: body });
      setAction(null);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiFetch('/api/admin/managers', {
        method: 'POST',
        json: {
          email: form.email.trim(),
          fullName: form.fullName.trim() || undefined,
          role: form.role,
        },
      });
      setForm({ email: '', fullName: '', role: 'admin' });
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-(--radius-input) border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-4 text-h3">{t('managers.add')}</h2>
        <p className="mb-4 text-sm text-(--ink-muted)">
          {/* FR-36: an email only; the account materialises on first sign-in. */}
          {t('login.help')}
        </p>

        <form onSubmit={add} className="space-y-4">
          <Field id="manager-email" label={t('managers.add_email')} required>
            {(props) => (
              <Input
                {...props}
                type="email"
                dir="ltr"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              />
            )}
          </Field>

          <Field id="manager-name" label={t('managers.add_name')}>
            {(props) => (
              <Input
                {...props}
                value={form.fullName}
                maxLength={80}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              />
            )}
          </Field>

          <Field id="manager-role" label={t('managers.column.role')} required>
            {(props) => (
              <Select
                {...props}
                value={form.role}
                onChange={(e) =>
                  setForm((c) => ({ ...c, role: e.target.value as typeof c.role }))
                }
              >
                <option value="admin">{t('managers.role.admin')}</option>
                <option value="super_admin">{t('managers.role.super_admin')}</option>
              </Select>
            )}
          </Field>

          <Button type="submit" disabled={pending || !form.email.includes('@')}>
            {pending ? t('admin.saving') : t('managers.add')}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-h3">{t('managers.title')}</h2>

        <div className="overflow-x-auto card">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('managers.title')}</caption>
            <thead>
              <tr className="border-b border-(--hairline) text-start">
                <th scope="col" className="p-3 text-start">
                  {t('managers.column.name')}
                </th>
                <th scope="col" className="p-3 text-start">
                  {t('managers.column.role')}
                </th>
                <th scope="col" className="p-3 text-start">
                  {t('managers.column.status')}
                </th>
                <th scope="col" className="p-3 text-start">
                  {t('managers.last_seen')}
                </th>
                <th scope="col" className="p-3 text-start">
                  <span className="sr-only">{t('common.confirm')}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {managers.map((manager) => (
                <tr
                  key={manager.id}
                  className={cn(
                    'border-b border-(--hairline) last:border-0',
                    manager.revokedAt && 'opacity-60',
                    manager.isSelf && 'bg-accent/10',
                  )}
                >
                  <td className="p-3">
                    <div className="font-semibold">
                      {manager.fullName ?? manager.email.split('@')[0]}
                      {manager.isSelf ? (
                        <span className="ms-2 rounded-full border border-accent-ink px-2 py-0.5 text-xs font-bold text-accent-ink">
                          {t('managers.self')}
                        </span>
                      ) : null}
                    </div>
                    <bdi dir="ltr" className="text-xs text-(--ink-muted)">
                      {manager.email}
                    </bdi>
                  </td>

                  <td className="p-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
                        manager.role === 'super_admin'
                          ? 'border-accent text-(--ink)'
                          : 'border-(--hairline) text-(--ink-muted)',
                      )}
                    >
                      {t(`managers.role.${manager.role}` as const)}
                    </span>
                  </td>

                  <td className="p-3">
                    {manager.revokedAt
                      ? t('managers.revoked')
                      : manager.hasSignedIn
                        ? t('managers.active')
                        : t('managers.never_signed_in')}
                  </td>

                  <td className="p-3 text-xs text-(--ink-muted)">
                    {manager.lastSeen ? formatRelative(manager.lastSeen) : '—'}
                  </td>

                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {manager.revokedAt ? (
                        <RowButton onClick={() => setAction({ kind: 'restore', manager })}>
                          {t('managers.restore')}
                        </RowButton>
                      ) : (
                        <>
                          {manager.role === 'admin' ? (
                            <RowButton onClick={() => setAction({ kind: 'promote', manager })}>
                              {t('managers.promote')}
                            </RowButton>
                          ) : (
                            <RowButton
                              // §10.8: prevented, not explained afterwards.
                              disabled={manager.isSelf}
                              title={manager.isSelf ? t('managers.self_locked') : undefined}
                              onClick={() => setAction({ kind: 'demote', manager })}
                            >
                              {t('managers.demote')}
                            </RowButton>
                          )}

                          <RowButton
                            danger
                            disabled={manager.isSelf}
                            title={manager.isSelf ? t('managers.self_locked') : undefined}
                            onClick={() => setAction({ kind: 'revoke', manager })}
                          >
                            {t('managers.revoke')}
                          </RowButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* §10.8: each action is confirmed by a dialog NAMING the person. */}
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action
            ? t('managers.confirm', {
                action: t(`managers.${action.kind}` as const),
                name: action.manager.fullName ?? action.manager.email,
              })
            : ''
        }
        confirmLabel={action ? t(`managers.${action.kind}` as const) : t('common.confirm')}
        destructive={action?.kind === 'revoke' || action?.kind === 'demote'}
        pending={pending}
        onConfirm={run}
      />
    </div>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'min-h-11 rounded-(--radius-input) border px-3 text-xs font-semibold',
        danger ? 'border-danger text-danger-ink' : 'border-(--hairline)',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  );
}
