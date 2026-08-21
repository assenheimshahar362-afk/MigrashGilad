'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { WEEKDAY_NAMES, formatDateLong } from '@/lib/time';
import type { RecurringRuleRow } from '@/lib/types';
import { usageTypeLabel } from '@/lib/usage-type';
import { apiFetch, errorText } from '@/lib/client-api';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';

/**
 * FR-34 / §10.9. A recurring series is now CREATED from the "אירוע חוזר" toggle
 * on `EventEditor` — there is no longer a standalone page for it — but the
 * series itself still needs somewhere to be seen and, eventually, withdrawn.
 * This is that place: a read-only roll call of the active rules, each ending
 * in the one action that applies to a whole series rather than one occurrence.
 *
 * Deleting here removes the RULE. The occurrences it already generated go with
 * it via `events.recurring_id ... on delete cascade` (§6.2) — an allocation
 * that is withdrawn should not leave ghost blocks on the public schedule. An
 * occurrence that only needs to move or vanish on its own stays exactly where
 * it always was: edited or deleted individually from the event list above,
 * like any other event.
 */
export function RecurringRulesList({ rules }: { rules: RecurringRuleRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<RecurringRuleRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    setError(null);
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

  if (rules.length === 0) {
    return <p className="empty-state">{t('admin.empty_generic')}</p>;
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-(--hairline) card">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-3 p-3">
            <Repeat className="size-4 shrink-0 text-(--ink-faint)" aria-hidden />

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{rule.title}</p>
              <p className="text-xs text-(--ink-muted)">
                {WEEKDAY_NAMES[rule.weekday]} ·{' '}
                <bdi dir="ltr" className="tnum">
                  {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
                </bdi>{' '}
                · {usageTypeLabel(rule.usage_type)} ·{' '}
                {rule.valid_until ? t('recurring.until', { date: formatDateLong(rule.valid_until) }) : t('recurring.no_end')}
                {rule.is_active ? '' : ` · ${t('recurring.field.active')}: ✕`}
              </p>
            </div>

            <IconButton
              label={`${t('admin.delete_event')} - ${rule.title}`}
              onClick={() => setDeleting(rule)}
              className="text-danger-ink"
            >
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('admin.delete_confirm', { name: deleting?.title ?? '' })}
        body={t('admin.delete_confirm_body')}
        confirmLabel={t('admin.delete_event')}
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
