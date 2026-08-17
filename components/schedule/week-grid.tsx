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
import { DayOpenLink } from '@/components/schedule/day-open-link';

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
    // All seven days at every width, with no scroll of its own — the columns
    // SHRINK to fit the shell instead of overflowing it.
    //
    // What changes below `sm` is what a column carries, not how many there
    // are: at ~45px per day there is no room for text, so a block drops to a
    // bare tinted band (§ event-block.tsx) and the grid reads as "when is the
    // pitch busy this week" rather than as a table with every cell elided to
    // the same truncated stub. The day strip, the hour axis and the legend
    // still carry names and times, and the accessible name on each block is
    // identical at every width.
    <div className="pitch-field max-w-full overflow-clip rounded-(--radius-card) border border-(--hairline) shadow-(--shadow-sm)">
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
            weekStart={weekStart}
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
      <div className="w-[clamp(1.75rem,9%,3.5rem)] shrink-0 pitch-touchline sm:w-14" aria-hidden />

      {days.map((date, index) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            className={cn('relative min-w-0 flex-1 py-2 text-center sm:py-2.5', index > 0 && 'pitch-daydivider')}
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
                // A capped square rather than a fixed `size-6`: that width is
                // in rem, so seven of them grow with the reader's text-size
                // setting and set a floor the seven columns cannot go below —
                // at 250% they alone demand more than a 320px phone has, and
                // the grid starts pushing the page sideways. Capped, each disc
                // shrinks with its own column instead.
                'tnum mx-auto mt-1 flex aspect-square w-full max-w-6 items-center justify-center rounded-full text-xs sm:max-w-7 sm:text-sm',
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

/** Phones carry no text inside a block (§ event-block.tsx), so an hour row
 *  only has to stay tall enough to read as a band rather than a line. Holding
 *  the desktop 32px there cost roughly 160px of scroll on a 16-hour day for
 *  height nothing was using. */
const MIN_HOUR_HEIGHT_MOBILE = 22;

/** The grid's body height, as CSS custom properties the class list below
 *  consumes — one floor per breakpoint, since a media query cannot be
 *  expressed in an inline style. Never so short that an hour row falls below
 *  its minimum for that width. */
function bodyStyle(startMinute: number, endMinute: number) {
  const hours = (endMinute - startMinute) / 60;
  return {
    '--grid-min-h': `${Math.ceil(hours * MIN_HOUR_HEIGHT_MOBILE)}px`,
    '--grid-min-h-sm': `${Math.ceil(hours * MIN_HOUR_HEIGHT)}px`,
  } as React.CSSProperties;
}

/** Shared by the axis and every day column so the two can never drift apart. */
const BODY_CLASS = 'relative h-[54vh] min-h-(--grid-min-h) sm:h-[68vh] sm:min-h-(--grid-min-h-sm)';

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
    <div className="relative w-[clamp(1.75rem,9%,3.5rem)] shrink-0 pitch-touchline sm:w-14" aria-hidden>
      <div className={BODY_CLASS} style={bodyStyle(startMinute, endMinute)}>
        {hourMarks.map((minute) => (
          <div
            key={minute}
            // `overflow-hidden`: the label is rem-sized, so at a large
            // text-size setting "07:00" grows wider than the touchline it sits
            // in and escapes sideways. Contained here rather than allowed to
            // widen the grid — the ruling it labels is still exact.
            className="absolute inset-x-0 -translate-y-1/2 overflow-hidden pe-1 text-end sm:pe-2"
            style={{ top: `${((minute - startMinute) / span) * 100}%` }}
          >
            <span className="tnum text-[0.625rem] font-medium text-(--ink-faint) sm:text-[0.6875rem]">
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
  weekStart,
  dayIndex,
  isToday,
  events,
  settings,
  startMinute,
  endMinute,
  hourMarks,
}: {
  date: LocalDate;
  weekStart: LocalDate;
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
      className={cn('relative min-w-0 flex-1', dayIndex > 0 && 'pitch-daydivider', isToday && 'pitch-today')}
    >
      <div className={BODY_CLASS} style={bodyStyle(startMinute, endMinute)}>
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

        {/* Phone-only: the column itself is the tap target, since the blocks
            inside it are far too narrow to be one (§ day-open-link.tsx). It is
            the LAST child so it sits above the blocks, and it disappears from
            `sm` up, where each block opens its own sheet instead. */}
        <DayOpenLink
          href={`/?view=day&week=${weekStart}&date=${date}`}
          label={t('schedule.open_day', { day: formatWeekdayLong(date) })}
        />
      </div>
    </div>
  );
}
