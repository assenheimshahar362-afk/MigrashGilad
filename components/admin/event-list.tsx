'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateShort, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { cn } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import type { EventRow } from '@/lib/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EventEditor } from '@/components/admin/event-editor';
import { TimeRange } from '@/components/ui/ltr';

/**
 * §10.9: every list has an empty state that invites the first action, and every
 * destructive action is confirmed by a dialog that NAMES the object.
 */
export function EventList({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <p className="rounded-[--radius-card] border border-dashed border-[--hairline] p-8 text-center text-[--ink-muted]">
        {t('schedule.empty')}
      </p>
    );
  }

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      router.refresh();
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-semibold text-signal-err">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-[--hairline] rounded-[--radius-card] border border-[--hairline] bg-[--surface-raised]">
        {events.map((event) => {
          const style = usageTypeStyle(event.usage_type);
          const date = localDate(event.starts_at);

          return (
            <li key={event.id} className="flex items-center gap-3 p-3">
              <span
                aria-hidden
                className={cn('size-3.5 shrink-0 rounded-sm', style.block, style.patternClass)}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{event.title}</p>
                <p className="text-xs text-[--ink-muted]">
                  {formatWeekdayLong(date)} {formatDateShort(date)} ·{' '}
                  <TimeRange range={formatTimeRange(event.starts_at, event.ends_at)} /> ·{' '}
                  {style.label}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditing(event)}
                aria-label={`${t('admin.edit_event')} — ${event.title}`}
                className="tap-target flex items-center justify-center rounded-[--radius-input] hover:bg-[--surface-sunken]"
              >
                <Pencil className="size-4" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => setDeleting(event)}
                aria-label={`${t('admin.delete_event')} — ${event.title}`}
                className="tap-target flex items-center justify-center rounded-[--radius-input] text-signal-err hover:bg-[--surface-sunken]"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent title={t('admin.edit_event')}>
          {editing ? <EventEditor event={editing} onDone={() => setEditing(null)} /> : null}
        </SheetContent>
      </Sheet>

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
