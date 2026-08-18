import { cn } from '@/lib/utils';
import { formatTimeRange, minutesSinceMidnight } from '@/lib/time';
import { usageTypeStyle } from '@/lib/usage-type';
import { eventDisplayTitle, type PublicEvent } from '@/lib/types';
import { TimeRange } from '@/components/ui/ltr';
import { EventDetailTrigger } from '@/components/schedule/event-detail-trigger';

/**
 * FR-3: an event block shows title, start–end time, and a usage-type colour AND
 * label AND pattern — never colour alone (A11Y-3).
 *
 * FR-4: tapping a block — at any width — opens its detail sheet, which is the
 * only place the whole of a booking is legible: a column on a phone is ~45px
 * wide and carries no text beyond the title. The sheet is still read-only;
 * acting on a booking remains the admin editor's job, behind auth.
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
  const title = eventDisplayTitle(event);
  // An unbooked stretch synthesized as a plain "community time" card (§
  // week-grid.tsx) has nothing to say beyond its own usage type — its title
  // IS the usage label, so the third line would just repeat the first.
  const showTypeLabel = title !== style.label;
  const label = showTypeLabel ? `${title}, ${range}, ${style.label}` : `${title}, ${range}`;

  /* A tinted card with a solid rule on its leading edge, in the manner of
     Google Calendar. The rule is `border-inline-start`, so it lands on the
     correct side under dir="rtl" without a second declaration.

     `z-30` puts it above the phone-only day-column overlay (z-20, §
     day-open-link.tsx): the column still catches taps on the EMPTY parts of
     the day, but a tap that lands on an event belongs to that event. */
  const blockClass = cn(
    'absolute z-30 overflow-hidden rounded-[6px] px-1 py-0.5 text-start sm:px-2 sm:py-1',
    'text-[0.5625rem] font-semibold leading-tight sm:text-xs',
    style.block,
    style.patternClass,
  );
  const position = { top: `${top}%`, height: `${height}%`, insetInlineStart, width };

  const content = (
    <div>
      <span className="block break-words leading-[1.15] sm:truncate sm:leading-[1.25]">{title}</span>
      <TimeRange
        range={range}
        className="tnum hidden text-[0.5rem] font-medium leading-[1.3] sm:block sm:text-[0.6875rem]"
      />
      {showTypeLabel ? (
        <span className="hidden truncate text-[0.5rem] font-normal leading-[1.25] sm:block sm:text-[0.625rem]">
          {style.label}
        </span>
      ) : null}
    </div>
  );

  // Whether this block is big enough to BE a target. A phone column is ~45px
  // wide (~35px on a folded Galaxy), which is fine on its own but is halved
  // when an association booking and community time share the slot — 12-22px,
  // under WCAG 2.5.8's 24px minimum, and `npm run check:responsive` fails the
  // build on it. From `sm` up even a halved column clears 24px comfortably, so
  // the split only matters below it.
  const tappable = cols === 1;

  const trigger = (extraClass?: string) => (
    /* FR-4: tapping a block opens its detail sheet — at every width for a
       block that has the column to itself, which is nearly all of them. The
       day-column overlay beneath it (§ day-open-link.tsx) stays regardless: it
       is the generous target for everything AROUND the blocks, and it is the
       only target for the narrow ones below. */
    <EventDetailTrigger
      event={event}
      aria-label={label}
      className={cn(
        blockClass,
        // The block is already a filled card, so "tappable" is signalled by
        // depth rather than by another fill: a small lift of the shadow,
        // nothing that changes the colour the legend keyed.
        'press-sm cursor-pointer',
        // A one-hour slot is 22px tall on a phone (§ week-grid.tsx
        // MIN_HOUR_HEIGHT_MOBILE) — under the same 24px minimum. The floor
        // costs 2px of overlap into the slot below at the very shortest
        // bookable length and nothing at any other, which is a better trade
        // than a target no thumb can find.
        'min-h-6 sm:min-h-0',
        'transition-[box-shadow,transform] duration-(--duration-press) ease-(--ease-out-quiet)',
        'hover:shadow-(--shadow-sm) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        extraClass,
      )}
      style={position}
    >
      {content}
    </EventDetailTrigger>
  );

  if (tappable) return trigger();

  return (
    <>
      {/* A shared slot on a phone: information, not a control, because at
          ~19px it cannot be an honest one. The day column underneath opens the
          day view, where both halves of the slot are full-width cards that
          each open this same sheet. `display:none` from `sm` up, so this is
          out of the accessibility tree entirely rather than a second copy of
          the same event. */}
      {/* `pointer-events-none`: this paints ABOVE the day-column link (z-30 to
          its z-20), and while it is not a control it would still swallow every
          tap that lands on it — leaving a shared slot as a dead patch of the
          grid where nothing at all happens. Taps pass straight through to the
          column, which is what opens the day. */}
      <div
        role="img"
        aria-label={label}
        className={cn(blockClass, 'pointer-events-none sm:hidden')}
        style={position}
      >
        {content}
      </div>

      {/* From `sm` up half a column is still ~42px, so the same block is a
          control again. */}
      {trigger('hidden sm:block')}
    </>
  );
}
