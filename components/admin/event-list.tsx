'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Repeat, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateShort, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { cn } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import { followingOccurrences, type EventScope } from '@/lib/event-series';
import type { EventRow } from '@/lib/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { EventEditor } from '@/components/admin/event-editor';
import { EventScopeChoice } from '@/components/admin/event-scope-choice';
import { TimeRange } from '@/components/ui/ltr';

/**
 * §10.9: every list has an empty state that invites the first action, and every
 * destructive action is confirmed by a dialog that NAMES the object.
 *
 * FR-33a: an occurrence that repeats — generated from a rule, or typed out
 * week after week — offers the edit and the delete a scope: this one, or this
 * one and every later one (§ lib/event-series.ts).
 */
export function EventList({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<EventScope>('single');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <p className="empty-state">
        {t('schedule.empty')}
      </p>
    );
  }

  /**
   * Whether this row has later ones the same edit could reach. Decided from
   * the window this page already loaded rather than with a query per row: the
   * question the admin is being asked is "does this repeat", and a booking
   * with no repeat anywhere in the next sixty days has nothing useful to
   * offer them even if a rule technically stretches beyond it. The server
   * re-derives the real set when the action is taken.
   */
  const repeats = (event: EventRow) => followingOccurrences(event, events).length > 1;

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    setError(null);
    try {
      const query = deleteScope === 'following' ? '?scope=following' : '';
      await apiFetch(`/api/admin/events/${deleting.id}${query}`, { method: 'DELETE' });
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
        <p role="alert" className="mb-3 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-(--hairline) card">
        {events.map((event) => {
          const style = usageTypeStyle(event.usage_type);
          const date = localDate(event.starts_at);
          const isRepeating = repeats(event);

          return (
            <li key={event.id} className="flex items-center gap-3 p-3">
              <span
                aria-hidden
                className={cn('size-3.5 shrink-0 rounded-sm', style.block, style.patternClass)}
              />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  <span className="truncate">{event.title}</span>
                  {/* Says, before the sheet is even opened, that this row is one
                      of several — which is what makes the scope question inside
                      it expected rather than a surprise. */}
                  {isRepeating ? (
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-(--radius-chip) px-2 py-0.5',
                        'bg-(--surface-sunken) text-[0.6875rem] font-semibold text-(--ink-muted)',
                      )}
                    >
                      <Repeat className="size-3" aria-hidden />
                      {event.recurring_id
                        ? t('admin.scope.recurring_badge')
                        : t('admin.scope.repeats_badge')}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-(--ink-muted)">
                  {formatWeekdayLong(date)} {formatDateShort(date)} ·{' '}
                  <TimeRange range={formatTimeRange(event.starts_at, event.ends_at)} /> ·{' '}
                  {style.label}
                </p>
              </div>

              <IconButton
                label={`${t('admin.edit_event')} — ${event.title}`}
                onClick={() => setEditing(event)}
              >
                <Pencil className="size-4" aria-hidden />
              </IconButton>

              <IconButton
                label={`${t('admin.delete_event')} — ${event.title}`}
                onClick={() => {
                  setDeleteScope('single');
                  setDeleting(event);
                }}
                className="text-danger-ink"
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>

      <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent title={t('admin.edit_event')}>
          {editing ? (
            <EventEditor
              event={editing}
              repeats={repeats(editing)}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('admin.delete_confirm', { name: deleting?.title ?? '' })}
        body={
          deleteScope !== 'following'
            ? t('admin.delete_confirm_body')
            : deleting?.recurring_id
              // A real series also has its rule closed off, which is a
              // consequence worth spelling out; a hand-entered repeat has no
              // rule behind it and simply loses the rows.
              ? t('admin.scope.delete_following_body')
              : t('admin.scope.delete_following_manual_body')
        }
        confirmLabel={t('admin.delete_event')}
        pending={pending}
        onConfirm={remove}
      >
        {deleting && repeats(deleting) ? (
          <EventScopeChoice
            value={deleteScope}
            onChange={setDeleteScope}
            disabled={pending}
            followingLabel={t('admin.scope.following')}
          />
        ) : null}
      </ConfirmDialog>
    </>
  );
}
