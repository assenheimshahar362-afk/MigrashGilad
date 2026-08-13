import { cn } from '@/lib/utils';
import { formatTimeRange, minutesSinceMidnight } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { firstNameOnly, type PublicEvent } from '@/lib/types';
import { TimeRange } from '@/components/ui/ltr';

/**
 * FR-3: an event block shows title, start–end time, and a usage-type colour AND
 * label AND pattern — never colour alone (A11Y-3).
 *
 * The public calendar is view-only: an existing booking is information, not a
 * control, so this renders as a plain `<div>` rather than a button and opens
 * nothing on tap. Only the admin panel's own event editor (a separate,
 * authenticated surface) can act on a booking.
 */
export function EventBlock({
  event,
  startMinute,
  endMinute,
  col = 0,
  cols = 1,
}: {
  event: PublicEvent;
  startMinute: number;
  endMinute: number;
  /** Side-by-side position within a cluster of overlapping events (association
   *  and community time may now share a slot — see `layoutDayEvents`). */
  col?: number;
  cols?: number;
}) {
  const style = usageTypeStyle(event.usageType);

  const span = endMinute - startMinute;
  const from = Math.max(minutesSinceMidnight(event.startsAt), startMinute);
  const to = Math.min(minutesSinceMidnight(event.endsAt), endMinute);

  // An event that starts before the visible window (or ends after it) is
  // clamped rather than dropped, so it never silently disappears from the grid.
  const top = ((from - startMinute) / span) * 100;
  const height = (Math.max(to - from, 15) / span) * 100;

  // Full width when nothing else shares this slot; split evenly, with a
  // hairline gap between them, when `layoutDayEvents` placed more than one
  // event in this cluster.
  const width = `calc(${100 / cols}% - ${cols > 1 ? '3px' : '2px'})`;
  const insetInlineStart = `calc(${(col / cols) * 100}% + 1px)`;

  const range = formatTimeRange(event.startsAt, event.endsAt);
  const title = displayTitle(event);
  // An unbooked stretch synthesized as a plain "community time" card (§
  // week-grid.tsx) has nothing to say beyond its own usage type — its title
  // IS the usage label, so the third line would just repeat the first.
  const showTypeLabel = title !== style.label;
  const label = showTypeLabel ? `${title}, ${range}, ${style.label}` : `${title}, ${range}`;

  return (
    <div
      role="img"
      aria-label={label}
      /* A tinted card with a solid rule on its leading edge, in the manner
         of Google Calendar. The rule is `border-inline-start`, so it lands on
         the correct side under dir="rtl" without a second declaration. */
      className={cn(
        'absolute z-10 overflow-hidden rounded-[6px] px-1 py-0.5 text-start sm:px-2 sm:py-1',
        'text-[0.5625rem] font-semibold leading-tight sm:text-xs',
        style.block,
        style.patternClass,
      )}
      style={{ top: `${top}%`, height: `${height}%`, insetInlineStart, width }}
    >
      {/* Seven columns on a phone leaves roughly 6 characters per line, so the
          three lines are set tight and the type label — which is also carried
          by the fill, the pattern and the accessible name — is the one that
          gives up its space first when the block is short. */}
      <span className="block truncate leading-[1.25]">{title}</span>
      <TimeRange
        range={range}
        className="tnum block text-[0.5rem] font-medium leading-[1.3] sm:text-[0.6875rem]"
      />
      {showTypeLabel ? (
        <span className="block truncate text-[0.5rem] font-normal leading-[1.25] sm:text-[0.625rem]">
          {style.label}
        </span>
      ) : null}
    </div>
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
