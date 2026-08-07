'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { formatTimeRange, formatWeekdayLong, localDate, minutesSinceMidnight } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { firstNameOnly, type PublicEvent } from '@/lib/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TimeRange, Ltr } from '@/components/ui/ltr';
import { formatIsraeliPhone, telLink } from '@/lib/utils';

/**
 * FR-3: an event block shows title, start–end time, and a usage-type colour AND
 * label AND pattern — never colour alone (A11Y-3).
 * FR-4: tapping opens a bottom sheet with the full detail.
 *
 * The block is server-rendered even though this is a client component, so the
 * schedule is readable with JavaScript disabled (FR-7). Only the sheet needs JS.
 */
export function EventBlock({
  event,
  startMinute,
  endMinute,
  gridRow,
}: {
  event: PublicEvent;
  startMinute: number;
  endMinute: number;
  /** Column index, used only for the keyboard grid's coordinates. */
  gridRow?: number;
}) {
  const [open, setOpen] = useState(false);
  const style = usageTypeStyle(event.usageType);

  const span = endMinute - startMinute;
  const from = Math.max(minutesSinceMidnight(event.startsAt), startMinute);
  const to = Math.min(minutesSinceMidnight(event.endsAt), endMinute);

  // An event that starts before the visible window (or ends after it) is
  // clamped rather than dropped, so it never silently disappears from the grid.
  const top = ((from - startMinute) / span) * 100;
  const height = (Math.max(to - from, 15) / span) * 100;

  const range = formatTimeRange(event.startsAt, event.endsAt);
  const title = displayTitle(event);
  const label = `${title}, ${range}, ${style.label}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-grid-cell
        data-grid-row={gridRow}
        aria-label={label}
        className={cn(
          'absolute inset-x-0.5 z-10 overflow-hidden px-1.5 py-1 text-start',
          'text-xs font-semibold leading-tight',
          style.block,
          style.patternClass,
        )}
        style={{ top: `${top}%`, height: `${height}%` }}
      >
        <span className="block truncate">{title}</span>
        <TimeRange range={range} className="block text-[0.65rem] font-normal opacity-90" />
        <span className="block truncate text-[0.65rem] font-normal opacity-90">{style.label}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={title} description={style.label}>
          <EventDetail event={event} />
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * FR-4: for approved public requests, the requester's FIRST NAME only. The
 * `events` row created by approve_request() stores the full name as the title,
 * so the trimming happens at render.
 */
function displayTitle(event: PublicEvent): string {
  return event.source === 'request' ? firstNameOnly(event.title) : event.title;
}

export function EventDetail({ event }: { event: PublicEvent }) {
  const style = usageTypeStyle(event.usageType);
  const date = localDate(event.startsAt);

  return (
    <dl className="space-y-3 text-sm">
      <Row label={t('event.time')}>
        <span className="block">{`${formatWeekdayLong(date)}`}</span>
        <TimeRange range={formatTimeRange(event.startsAt, event.endsAt)} />
      </Row>

      <Row label={t('event.type')}>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className={cn('inline-block size-3.5 rounded-sm', style.block, style.patternClass)}
          />
          {style.label}
        </span>
      </Row>

      {event.description ? <Row label={t('event.description')}>{event.description}</Row> : null}

      {event.contactName ? (
        <Row label={t('event.responsible')}>
          {event.source === 'request' ? firstNameOnly(event.contactName) : event.contactName}
          {/* §7 PII: the phone is present here only when show_contact = true,
              and the server has already stripped it otherwise. */}
          {event.contactPhone ? (
            <a
              href={telLink(event.contactPhone)}
              className="ms-2 underline underline-offset-4"
            >
              <Ltr>{formatIsraeliPhone(event.contactPhone)}</Ltr>
            </a>
          ) : null}
        </Row>
      ) : null}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-[--ink-muted]">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
