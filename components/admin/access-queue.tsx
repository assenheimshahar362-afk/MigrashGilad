'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/time';
import { apiFetch, errorText } from '@/lib/client-api';
import type { AccessRequest, AdminRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * §10.8a `/admin/access` — super admin only.
 *
 * Approving grants admin rights, so it is confirmed by a dialog that names the
 * person and states the role being granted. The role is chosen before the
 * dialog opens rather than inside it: an approval that silently defaults to
 * `super_admin` is the kind of mistake this screen exists to prevent.
 */
type PendingAction = { request: AccessRequest; approve: boolean } | null;

export function AccessQueue({ requests }: { requests: AccessRequest[] }) {
  const router = useRouter();
  const [action, setAction] = useState<PendingAction>(null);
  const [role, setRole] = useState<AdminRole>('admin');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiting = requests.filter((request) => request.status === 'pending');
  const decided = requests.filter((request) => request.status !== 'pending');

  const run = async () => {
    if (!action) return;
    setPending(true);
    setError(null);

    try {
      await apiFetch(`/api/admin/access/${action.request.id}`, {
        method: 'PATCH',
        json: { approve: action.approve, role },
      });
      setAction(null);
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

      <section>
        <h2 className="mb-3 text-h3">
          {t('access.pending_title')}
          {waiting.length > 0 ? (
            <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-white">
              {waiting.length}
            </span>
          ) : null}
        </h2>

        {waiting.length === 0 ? (
          <p className="empty-state">{t('access.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((request) => (
              <li key={request.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{request.fullName ?? request.email.split('@')[0]}</p>
                  <bdi dir="ltr" className="block truncate text-xs text-(--ink-muted)">
                    {request.email}
                  </bdi>
                  <p className="mt-1 text-xs text-(--ink-faint)">
                    {request.provider === 'google' ? 'Google' : t('access.provider_password')} ·{' '}
                    {formatRelative(request.createdAt)}
                  </p>
                </div>

                {/* Already on the allowlist: approving again would be a no-op
                    that reads as if it did something. */}
                {request.alreadyAdmin ? (
                  <span className="rounded-full border border-(--hairline) px-2 py-0.5 text-xs font-semibold text-(--ink-muted)">
                    {t('access.already_admin')}
                  </span>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setRole('admin');
                      setAction({ request, approve: true });
                    }}
                  >
                    {t('access.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setAction({ request, approve: false })}
                  >
                    {t('access.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section>
          <h2 className="mb-3 text-h3">{t('access.decided_title')}</h2>
          <ul className="card divide-y divide-(--hairline)">
            {decided.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <bdi dir="ltr" className="min-w-0 flex-1 truncate">
                  {request.email}
                </bdi>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs font-semibold',
                    request.status === 'approved'
                      ? 'border-success text-success-ink'
                      : 'border-(--hairline) text-(--ink-muted)',
                  )}
                >
                  {t(request.status === 'approved' ? 'access.approved' : 'access.rejected')}
                </span>
                <span className="text-xs text-(--ink-faint)">
                  {request.decidedAt ? formatRelative(request.decidedAt) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action
            ? t(action.approve ? 'access.confirm_approve' : 'access.confirm_reject', {
                name: action.request.fullName ?? action.request.email,
              })
            : ''
        }
        confirmLabel={action?.approve ? t('access.approve') : t('access.reject')}
        destructive={action?.approve === false}
        pending={pending}
        onConfirm={run}
      >
        {action?.approve ? (
          <fieldset className="mt-2">
            <legend className="mb-2 text-sm font-semibold">{t('managers.column.role')}</legend>
            <div className="flex gap-2">
              {(['admin', 'super_admin'] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-(--radius-input)',
                    'border px-3 text-sm font-semibold',
                    role === value
                      ? 'border-primary bg-primary-50 text-primary-700'
                      : 'border-(--hairline) text-(--ink-muted)',
                  )}
                >
                  <input
                    type="radio"
                    name="access-role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="sr-only"
                  />
                  {t(`managers.role.${value}` as const)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
