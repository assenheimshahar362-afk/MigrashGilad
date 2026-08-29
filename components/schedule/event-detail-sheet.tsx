'use client';

import { Clock, FileText, MessageSquareText, Phone, Tag, User } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Ltr, TimeRange } from '@/components/ui/ltr';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { formatDateLong, formatTimeRange, formatWeekdayLong, localDate } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { eventDisplayTitle, type PublicEvent } from '@/lib/types';

/**
 * FR-4: tapping a block on the calendar opens its detail sheet. The grid can
 * only ever show a title and a time — on a phone column it shows neither — so
 * everything else a visitor might want (who is responsible, what the booking
 * actually is, how to reach them) lives here rather than being unreachable.
 *
 * Mounted once by `<EventDetailProvider>`, not per event: a week holds dozens
 * of blocks, and a Radix dialog per block would be dozens of portals for one
 * that can ever be open.
 *
 * Read-only, like the calendar it opens from. Nothing here edits a booking —
 * that stays in the authenticated admin editor.
 */
export function EventDetailSheet({
  event,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  event: PublicEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns focus to the block that opened this (§ ui/return-focus.ts). */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  // Null only before the first open: the provider deliberately keeps the last
  // event after closing, so the sheet still has something to render while its
  // exit animation plays.
  if (!event) return null;

  const style = usageTypeStyle(event.usageType);
  const date = localDate(event.startsAt);
  const title = eventDisplayTitle(event);
  // A synthesized community-time filler's title IS its usage label (§
  // lib/schedule.ts) — repeating it as a heading and again as the type row
  // would say the same word twice.
  const heading = title === style.label ? style.label : title;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={heading}
        description={`${formatWeekdayLong(date)}, ${formatDateLong(date)}`}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <dl className="space-y-4">
          <DetailRow icon={Clock} label={t('event.time')}>
            <TimeRange
              range={formatTimeRange(event.startsAt, event.endsAt)}
              className="text-base font-semibold text-(--ink)"
            />
          </DetailRow>

          <DetailRow icon={Tag} label={t('event.type')}>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-(--radius-chip) px-2.5 py-1 text-sm font-semibold',
                style.chip,
                style.patternClass,
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', style.bar)} aria-hidden />
              {style.label}
            </span>
          </DetailRow>

          {/* The manager-written description is the activity context. For an
              approved request it is entered as part of the decision; for a
              manual activity it comes from the create/edit form. */}
          {event.description ? (
            <DetailRow icon={FileText} label={t('event.description')}>
              <p className="text-sm leading-relaxed whitespace-pre-line text-(--ink)">
                {event.description}
              </p>
            </DetailRow>
          ) : null}

          {/* This is what the requester typed on the public form, carried
              onto the event by `approve_request` and published only once an
              admin ticks `show_note` — `toPublicEvent` returns null for it
              otherwise, so an unapproved note never reaches the browser.
              `whitespace-pre-line` keeps the line breaks they typed. */}
          {event.requesterNote ? (
            <DetailRow icon={MessageSquareText} label={t('event.note')}>
              <p className="text-sm leading-relaxed whitespace-pre-line text-(--ink)">
                {event.requesterNote}
              </p>
            </DetailRow>
          ) : null}

          {event.contactName ? (
            <DetailRow icon={User} label={t('event.responsible')}>
              <p className="text-sm font-semibold text-(--ink)">{event.contactName}</p>
              {/* §7 PII: a phone number is in `PublicEvent` at all only when the
                  booking was marked `show_contact`, so if it is here it is meant
                  to be dialled. */}
              {event.contactPhone ? (
                <a
                  href={`tel:${event.contactPhone}`}
                  className={cn(
                    'mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-700',
                    'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet) hover:text-primary-800',
                  )}
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  <Ltr>{event.contactPhone}</Ltr>
                </a>
              ) : null}
            </DetailRow>
          ) : null}
        </dl>

        {/* An approved public request is titled with the requester's name and
            nothing else, which on its own reads as a heading with no
            explanation. This is the line that says what that name is — skipped
            when the "responsible" row above already shows the same name under a
            label of its own, so the sheet does not print it three times. */}
        {event.source === 'request' && event.contactName !== title ? (
          <p className="mt-5 border-t border-(--hairline) pt-4 text-sm text-(--ink-muted)">
            {t('event.requested_by', { name: title })}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * One labelled fact. The icon is decorative — the `<dt>` it sits in already
 * names the row, so an icon-only label would be the only copy of that name.
 *
 * It lives INSIDE the `<dt>` rather than beside it, and `<dt>`/`<dd>` are the
 * only children of the row: a description list's content model allows
 * `dl > div > (dt, dd)` and nothing deeper, and burying the pair one level
 * further down (the shape this had at first) breaks the association a screen
 * reader announces — axe reports it as `dlitem`/`definition-list`. Same row
 * rhythm as the accessibility statement's coordinator card, so the two
 * label/value blocks in the product read the same way.
 */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <dt className="flex w-28 shrink-0 items-center gap-2.5 pt-1.5 text-xs font-semibold text-(--ink-faint)">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--surface-sunken) text-(--ink-muted)"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 pt-1.5">{children}</dd>
    </div>
  );
}
