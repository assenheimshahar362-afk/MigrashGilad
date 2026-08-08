import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import {
  WEEKDAY_LETTERS,
  dayOfMonth,
  formatWeekdayLong,
  localWeekDays,
  timeFromMinutes,
  todayLocal,
  type LocalDate,
} from '@/lib/time';
import {
  closuresForDate,
  eventsForDate,
  gridHourRange,
  hoursForDate,
  isSlotClosed,
  layoutDayEvents,
} from '@/lib/schedule';
import { toInstant } from '@/lib/time';
import type { PublicClosure, PublicEvent, PublicSettings } from '@/lib/types';
import { EventBlock } from '@/components/schedule/event-block';
import { NowMarker } from '@/components/schedule/now-marker';
import { GridKeyboardScope } from '@/components/schedule/grid-keyboard';

/** The granularity of the tappable empty-slot cells (FR-10). */
const SLOT_MINUTES = 60;

/**
 * §10.1 time grid. The signature element (§11.3): pitch line-markings drawn as
 * chalk hairlines on the dark turf field, with the hour axis rendered like the
 * touchline.
 *
 * FR-1: all seven days are shown and all seven are bookable. Friday and
 * Saturday are rendered identically to the rest of the week — there is no
 * weekend branch in this file, and adding one would be a bug (scenario 18).
 *
 * Sunday is the first column, which in `dir="rtl"` puts it rightmost, next to
 * the touchline.
 */
export function WeekGrid({
  weekStart,
  events,
  closures,
  settings,
}: {
  weekStart: LocalDate;
  events: PublicEvent[];
  closures: PublicClosure[];
  settings: PublicSettings;
}) {
  const days = localWeekDays(weekStart);
  const { startMinute, endMinute } = gridHourRange(settings.openingHours, days);
  const today = todayLocal();

  const hourMarks: number[] = [];
  for (let m = Math.ceil(startMinute / 60) * 60; m <= endMinute; m += 60) hourMarks.push(m);

  return (
    <GridKeyboardScope>
      {/* The same seven-day grid at every width — a phone gets this exact
          layout, not a simplified stand-in. Below `lg`, where seven 104px
          columns plus the axis (≈49rem) no longer fit the shell, the card
          scrolls horizontally instead of squeezing them illegible; the hour
          axis and day-name row stay pinned to their edges while it does, via
          `sticky` on both axes, so there is always a frame of reference for
          what is currently in view. `max-h` + `overflow-auto` turn the
          vertical scroll from page-level to internal, which `position:
          sticky` needs in order to pin horizontally too — a sticky element's
          containing block has to actually be a scroll container on the axis
          it needs to pin against.

          From `lg` up, all seven columns already fit at their natural
          `flex-1` width with room to spare, so there is nothing to scroll —
          the card reverts to `overflow-visible`, unbounded height, and the
          page-level scroll (with the day row sticking under the site header
          instead of the card's own top) that this had before. Without this
          the `lg:` split, `overflow-auto`+`max-h` would still show a
          scrollbar's reserved gutter on a screen that never needs one. */}
      <div
        className={cn(
          'pitch-field overflow-auto rounded-(--radius-card) border border-(--hairline)',
          'shadow-(--shadow-sm) max-h-[75vh] lg:max-h-none lg:overflow-visible',
        )}
      >
        <DayHeader days={days} today={today} />

        {/* No `role="grid"` here. The layout is seven day-COLUMNS with no
            rows, so the grid role's required `row` children can never exist and
            asserting it produces a broken accessibility tree rather than a
            useful one. A11Y-5's <DayList> is the accessible representation of
            this data, and A11Y-4's arrow-key movement is driven by the
            `data-grid-*` attributes, not by ARIA. */}
        {/* The half-row of padding gives the first and last hour labels, which
            are centred on their own rule, somewhere to sit without being
            clipped by the day strip above or the card edge below. */}
        <div className="flex pt-3 pb-3" role="presentation">
          <HourAxis hourMarks={hourMarks} startMinute={startMinute} endMinute={endMinute} />

          {days.map((date, dayIndex) => (
            <DayColumn
              key={date}
              date={date}
              dayIndex={dayIndex}
              isToday={date === today}
              events={eventsForDate(events, date)}
              closures={closuresForDate(closures, date)}
              settings={settings}
              startMinute={startMinute}
              endMinute={endMinute}
              hourMarks={hourMarks}
            />
          ))}
        </div>
      </div>
    </GridKeyboardScope>
  );
}

/** §10.1 week strip: Hebrew day letters plus day-of-month, today highlighted. */
function DayHeader({ days, today }: { days: LocalDate[]; today: LocalDate }) {
  return (
    // Below `lg` this sticks to the top of the card's own scroll area — see
    // the `max-h` note above. From `lg`, the card no longer scrolls itself
    // and this reverts to sticking under the site header as the PAGE
    // scrolls, exactly as it did before the card became scrollable.
    <div className="sticky top-0 z-20 flex border-b border-(--grid-line-strong) bg-(--surface-raised) lg:top-(--header-h)">
      {/* Spacer matching the hour axis width. Pinned to the same edge as
          <HourAxis>, so the corner cell stays put through both scroll axes. */}
      <div className="sticky start-0 z-10 w-14 shrink-0 bg-(--surface-raised) pitch-touchline" aria-hidden />

      {days.map((date, index) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            className={cn(
              'relative min-w-[6.5rem] flex-1 py-2.5 text-center',
              index > 0 && 'pitch-daydivider',
            )}
          >
            <div
              className={cn(
                'text-[0.6875rem] font-medium',
                isToday ? 'font-semibold text-primary-600' : 'text-(--ink-faint)',
              )}
            >
              {WEEKDAY_LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()]}
            </div>
            {/* Today's date sits in a filled green disc. It is the one thing on
                the strip that is a shape rather than a weight, which is why the
                eye finds it before it has read anything. */}
            <div
              className={cn(
                'tnum mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-sm',
                isToday
                  ? 'bg-primary font-bold text-white shadow-(--shadow-xs)'
                  : 'font-medium text-(--ink)',
              )}
            >
              {dayOfMonth(date)}
            </div>
            <span className="sr-only">{formatWeekdayLong(date)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The height every hour row gets, so a one-hour slot clears A11Y-1's 44px. */
const MIN_HOUR_HEIGHT = 44;

/** The grid's body height: 68vh, but never so short that an hour row falls
 *  below a comfortable tap target. */
function bodyStyle(startMinute: number, endMinute: number) {
  const hours = (endMinute - startMinute) / 60;
  return { minHeight: `${Math.ceil(hours * MIN_HOUR_HEIGHT)}px` };
}

/** The touchline: the hour axis, on the right in RTL. */
function HourAxis({
  hourMarks,
  startMinute,
  endMinute,
}: {
  hourMarks: number[];
  startMinute: number;
  endMinute: number;
}) {
  const span = endMinute - startMinute;

  return (
    <div
      className="sticky start-0 z-10 w-14 shrink-0 bg-(--grid-surface) pitch-touchline"
      aria-hidden
    >
      <div className="relative h-[68vh]" style={bodyStyle(startMinute, endMinute)}>
        {hourMarks.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 -translate-y-1/2 pe-2 text-end"
            style={{ top: `${((minute - startMinute) / span) * 100}%` }}
          >
            <span className="tnum text-[0.6875rem] font-medium text-(--ink-faint)">
              {timeFromMinutes(minute)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  date,
  dayIndex,
  isToday,
  events,
  closures,
  settings,
  startMinute,
  endMinute,
  hourMarks,
}: {
  date: LocalDate;
  dayIndex: number;
  isToday: boolean;
  events: PublicEvent[];
  closures: PublicClosure[];
  settings: PublicSettings;
  startMinute: number;
  endMinute: number;
  hourMarks: number[];
}) {
  const span = endMinute - startMinute;
  const dayHours = hoursForDate(settings.openingHours, date);
  const allDayClosure = closures.find((closure) => closure.allDay);

  return (
    <div
      className={cn(
        'relative min-w-[6.5rem] flex-1',
        dayIndex > 0 && 'pitch-daydivider',
        isToday && 'pitch-today',
      )}
    >
      <div className="relative h-[68vh]" style={bodyStyle(startMinute, endMinute)}>
        {/* Hour hairlines. */}
        {hourMarks.map((minute) => (
          <div
            key={minute}
            aria-hidden
            className="pitch-hourline absolute inset-x-0"
            style={{ top: `${((minute - startMinute) / span) * 100}%` }}
          />
        ))}

        {/* FR-37a: a day may be closed all day in settings. It still occupies a
            column — it is never removed from the week. */}
        {!dayHours ? (
          <div className="closure-hatch absolute inset-0 z-10 flex items-center justify-center">
            <span className="rounded-(--radius-chip) bg-(--surface-raised) px-2.5 py-1 text-[0.65rem] font-semibold text-danger-ink shadow-(--shadow-xs) ring-1 ring-danger/25">
              {t('schedule.closed_day')}
            </span>
          </div>
        ) : null}

        {/* FR-9: closures render as a hatch over the affected hours and suppress
            the request affordance. */}
        {closures.map((closure) => (
          <ClosureOverlay
            key={closure.id}
            closure={closure}
            date={date}
            startMinute={startMinute}
            endMinute={endMinute}
          />
        ))}

        {/* FR-10: empty slots inside opening hours are tappable and pre-fill the
            request form with that date and time. */}
        {dayHours && !allDayClosure && settings.requestsOpen
          ? buildSlots(dayHours, startMinute, endMinute).map((slot, slotIndex) => {
              const start = toInstant(date, timeFromMinutes(slot.from));
              const end = toInstant(date, timeFromMinutes(slot.to));
              const busy =
                isSlotClosed(closures, start, end) ||
                events.some(
                  (event) =>
                    new Date(event.startsAt) < end && start < new Date(event.endsAt),
                );
              if (busy) return null;

              return (
                <Link
                  key={slot.from}
                  href={`/request?date=${date}&start=${timeFromMinutes(slot.from)}&end=${timeFromMinutes(slot.to)}`}
                  data-grid-cell
                  data-grid-col={dayIndex}
                  data-grid-row={slotIndex}
                  aria-label={`${formatWeekdayLong(date)} ${timeFromMinutes(slot.from)} — ${t('schedule.free_slot')}`}
                  /* A free hour is an invitation, so it warms rather than
                     greys under the pointer — the same amber the CTA uses,
                     at the lowest alpha that still registers. The inset ring
                     draws the slot's own edges, which is what tells you the
                     tap will book that hour and not the whole column. */
                  /* A free hour is an invitation: it warms to the brand green
                     under the pointer and reveals a "+" that is not drawn until
                     there is a pointer to draw it for. On touch there is no
                     hover, so the whole cell is simply tappable. */
                  className={cn(
                    'group absolute inset-x-px flex items-center justify-center rounded-[6px]',
                    'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
                    'hover:bg-primary-50 focus-visible:bg-primary-50',
                    'motion-reduce:transition-none',
                  )}
                  style={{
                    top: `${((slot.from - startMinute) / span) * 100}%`,
                    height: `${((slot.to - slot.from) / span) * 100}%`,
                  }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full bg-primary text-white',
                      'opacity-0 transition-opacity duration-(--duration-tip) ease-(--ease-out-quiet)',
                      'group-hover:opacity-100 group-focus-visible:opacity-100',
                      'motion-reduce:transition-none',
                    )}
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                  </span>
                </Link>
              );
            })
          : null}

        {layoutDayEvents(events).map(({ event, col, cols }) => (
          <EventBlock
            key={event.id}
            event={event}
            startMinute={startMinute}
            endMinute={endMinute}
            col={col}
            cols={cols}
          />
        ))}

        <NowMarker date={date} startMinute={startMinute} endMinute={endMinute} />
      </div>
    </div>
  );
}

function buildSlots(
  dayHours: [string, string],
  startMinute: number,
  endMinute: number,
): Array<{ from: number; to: number }> {
  const [open, close] = dayHours;
  const openMinute = Math.max(startMinute, minutes(open));
  const closeMinute = Math.min(endMinute, minutes(close));
  const slots: Array<{ from: number; to: number }> = [];

  for (let m = openMinute; m + SLOT_MINUTES <= closeMinute; m += SLOT_MINUTES) {
    slots.push({ from: m, to: m + SLOT_MINUTES });
  }
  return slots;
}

function minutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

function ClosureOverlay({
  closure,
  date,
  startMinute,
  endMinute,
}: {
  closure: PublicClosure;
  date: LocalDate;
  startMinute: number;
  endMinute: number;
}) {
  const span = endMinute - startMinute;
  const dayStart = toInstant(date, '00:00').getTime();

  const from = closure.allDay
    ? startMinute
    : Math.max(startMinute, (new Date(closure.startsAt).getTime() - dayStart) / 60_000);
  const to = closure.allDay
    ? endMinute
    : Math.min(endMinute, (new Date(closure.endsAt).getTime() - dayStart) / 60_000);

  if (to <= from) return null;

  return (
    <div
      className="closure-hatch pointer-events-none absolute inset-x-0 z-[5] border-y border-danger/40"
      style={{ top: `${((from - startMinute) / span) * 100}%`, height: `${((to - from) / span) * 100}%` }}
      title={closure.reason}
    >
      <span className="sr-only">{t('schedule.closed_banner', { reason: closure.reason })}</span>
    </div>
  );
}
