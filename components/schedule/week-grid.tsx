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
  eventsForDate,
  eventsWithCommunityFill,
  gridHourRange,
  hoursForDate,
  layoutDayEvents,
} from '@/lib/schedule';
import type { PublicEvent, PublicSettings } from '@/lib/types';
import { EventBlock } from '@/components/schedule/event-block';
import { NowMarker } from '@/components/schedule/now-marker';

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
  settings,
}: {
  weekStart: LocalDate;
  events: PublicEvent[];
  settings: PublicSettings;
}) {
  const days = localWeekDays(weekStart);
  const { startMinute, endMinute } = gridHourRange(settings.openingHours, days);
  const today = todayLocal();

  // Every TWO hours rather than every one: at an hourly cadence the axis and
  // the hairlines it drives (§ DayColumn below) made the whole grid read as
  // much taller than the day actually needs. Halving the mark count halves
  // the ruling without touching where an event itself is positioned — a
  // booking still lands at its exact minute, just against a coarser ruler.
  //
  // Anchored on the pitch's own opening hour rather than on a round clock
  // number: opening is 07:00, so counting by two from there lands on
  // 7‑9‑11‑…‑23 — every mark an odd hour, which reads as one continuous rule
  // rather than the arbitrary 8‑10‑12‑… you'd get by rounding up to the
  // nearest even hour first.
  const hourMarks: number[] = [];
  for (let m = startMinute; m <= endMinute; m += 120) hourMarks.push(m);

  return (
    // The same seven-day grid at every width, with no scroll of its own at
    // any width — the seven columns SHRINK to fit the shell instead of
    // overflowing it. The hour axis narrows and the day-name text drops a
    // size below `sm` so a 320px phone still holds all seven without a
    // scrollbar; nothing is cropped, just smaller.
    <div className="pitch-field overflow-clip rounded-(--radius-card) border border-(--hairline) shadow-(--shadow-sm)">
      <DayHeader days={days} today={today} />

      {/* The grid is read-only: nothing in it is a control, so there is no
          `role="grid"`, no keyboard grid navigation and no per-cell markup —
          just seven day-columns of information. A11Y-5's <DayList> is the
          accessible representation of the same data. */}
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
            settings={settings}
            startMinute={startMinute}
            endMinute={endMinute}
            hourMarks={hourMarks}
          />
        ))}
      </div>
    </div>
  );
}

/** §10.1 week strip: Hebrew day letters plus day-of-month, today highlighted. */
function DayHeader({ days, today }: { days: LocalDate[]; today: LocalDate }) {
  return (
    // The strip sticks under the site header so the day you are looking at
    // is still named once you have scrolled down to the evening hours.
    <div className="sticky top-(--header-h) z-20 flex border-b border-(--grid-line-strong) bg-(--surface-raised)">
      {/* Spacer matching the hour axis width — narrower on a phone, see
          <HourAxis>. */}
      <div className="w-10 shrink-0 pitch-touchline sm:w-14" aria-hidden />

      {days.map((date, index) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            className={cn('relative flex-1 py-2 text-center sm:py-2.5', index > 0 && 'pitch-daydivider')}
          >
            <div
              className={cn(
                'text-[0.625rem] font-medium sm:text-[0.6875rem]',
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
                'tnum mx-auto mt-1 flex size-6 items-center justify-center rounded-full text-xs sm:size-7 sm:text-sm',
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

/** The height every hour row gets. An event here is `role="img"` — read-only
 *  information, never a tap target — so this no longer has to clear A11Y-1's
 *  44px the way the axis's OWN clickable rows would; it only has to stay tall
 *  enough that the shortest bookable slot (one hour) keeps its title and time
 *  legible. Lower than the old 44px on purpose: it is what actually shortens
 *  the grid, now that the axis marks every two hours instead of one. */
const MIN_HOUR_HEIGHT = 32;

/** The grid's body height: 68vh, but never so short that an hour row falls
 *  below its minimum. */
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
    <div className="relative w-10 shrink-0 pitch-touchline sm:w-14" aria-hidden>
      <div className="relative h-[68vh]" style={bodyStyle(startMinute, endMinute)}>
        {hourMarks.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 -translate-y-1/2 pe-1 text-end sm:pe-2"
            style={{ top: `${((minute - startMinute) / span) * 100}%` }}
          >
            <span className="tnum text-[0.5625rem] font-medium text-(--ink-faint) sm:text-[0.6875rem]">
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
  settings,
  startMinute,
  endMinute,
  hourMarks,
}: {
  date: LocalDate;
  dayIndex: number;
  isToday: boolean;
  events: PublicEvent[];
  settings: PublicSettings;
  startMinute: number;
  endMinute: number;
  hourMarks: number[];
}) {
  const span = endMinute - startMinute;
  const dayHours = hoursForDate(settings.openingHours, date);

  // Every genuinely empty minute of the day's own opening hours is
  // community time by default, whether or not it was ever booked — so a
  // gap with nothing in it gets an actual "community time" card synthesized
  // for it, the same way a real booking would render.
  const dayEvents = eventsWithCommunityFill(events, date, settings.openingHours) ?? events;

  return (
    <div
      className={cn('relative flex-1', dayIndex > 0 && 'pitch-daydivider', isToday && 'pitch-today')}
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

        {layoutDayEvents(dayEvents).map(({ event, col, cols }) => (
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
