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
          {/* FR-36: an email only; the account materialises on first sign-in.
              Adding here bypasses the /admin/access queue entirely — this is
              the direct path, that one is the self-service one. */}
          {t('managers.add_help')}
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

        {/* A card list, not a table.
            It WAS a five-column table in a horizontally scrolling card, and on a
            phone that table's own minimum width (a name, an email, two chips, a
            relative date and two buttons) came to ~556px against a 341px card.
            The scroll container clipped it visually but the document still grew
            with it — under dir="rtl" the overflow lands on the inline-start side
            and Chromium extends the page's scrollable area regardless of the
            container's overflow-x — so the whole admin area scrolled sideways.
            Nothing containable fixed that: min-width, max-width, overflow-x:
            scroll, contain, and clipping the <main> all left the page 496px wide
            in a 375px viewport.

            So the row reflows instead of scrolling, which is what every other
            list in this area already does (§ access-queue.tsx) — same card, same
            `min-w-0 flex-1` name block, same wrapped action buttons. Each value
            names itself now that there are no column headers above it: the role
            and status are chips that read as words, and the last-seen date
            carries its own label. */}
        <ul className="card divide-y divide-(--hairline)">
          {managers.map((manager) => (
            <li
              key={manager.id}
              className={cn(
                'flex flex-wrap items-center gap-3 p-3 sm:p-4',
                manager.revokedAt && 'opacity-60',
                manager.isSelf && 'bg-accent/10',
              )}
            >
              {/* `basis-full` below `sm`: on a phone the name, the email and
                  the status want the whole line, so the buttons wrap under them
                  rather than squeezing a three-word name into a column an inch
                  wide. From `sm` the row has space for both side by side. */}
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {manager.fullName ?? manager.email.split('@')[0]}
                  </span>

                  {manager.isSelf ? (
                    <span className="rounded-full border border-accent-ink px-2 py-0.5 text-xs font-bold text-accent-ink">
                      {t('managers.self')}
                    </span>
                  ) : null}

                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-semibold',
                      manager.role === 'super_admin'
                        ? 'border-accent text-(--ink)'
                        : 'border-(--hairline) text-(--ink-muted)',
                    )}
                  >
                    {t(`managers.role.${manager.role}` as const)}
                  </span>
                </div>

                {/* The one genuinely unbreakable string on the row, so it is
                    the one thing allowed to truncate. */}
                <bdi dir="ltr" className="mt-0.5 block truncate text-xs text-(--ink-muted)">
                  {manager.email}
                </bdi>

                <p className="mt-1 text-xs text-(--ink-faint)">
                  {manager.revokedAt
                    ? t('managers.revoked')
                    : manager.hasSignedIn
                      ? t('managers.active')
                      : t('managers.never_signed_in')}
                  {manager.lastSeen
                    ? ` · ${t('managers.last_seen')}: ${formatRelative(manager.lastSeen)}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
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
            </li>
          ))}
        </ul>
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
