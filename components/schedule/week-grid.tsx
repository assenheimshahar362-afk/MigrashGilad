import Link from 'next/link';
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
      <div className="pitch-field overflow-hidden">
        <DayHeader days={days} today={today} />

        <div className="flex" role="grid" aria-label={t('schedule.title')}>
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
    <div className="flex border-b border-[--grid-line]">
      {/* Spacer matching the hour axis width. */}
      <div className="w-11 shrink-0 pitch-touchline" aria-hidden />

      {days.map((date, index) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            className={cn(
              'flex-1 py-2 text-center',
              index > 0 && 'pitch-daydivider',
              isToday && 'bg-chalk-050/10',
            )}
          >
            <div
              className={cn(
                'text-xs',
                isToday ? 'font-bold text-floodlight' : 'text-chalk-200',
              )}
            >
              {WEEKDAY_LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()]}
            </div>
            <div
              className={cn(
                'tnum text-sm',
                isToday ? 'font-bold text-floodlight' : 'text-chalk-050',
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
    <div className="relative w-11 shrink-0 pitch-touchline" aria-hidden>
      <div className="relative h-[60vh] min-h-[26rem]">
        {hourMarks.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 -translate-y-1/2 pe-1.5 text-end"
            style={{ top: `${((minute - startMinute) / span) * 100}%` }}
          >
            <span className="tnum text-[0.65rem] text-chalk-200">{timeFromMinutes(minute)}</span>
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
      role="gridcell"
      className={cn('relative flex-1', dayIndex > 0 && 'pitch-daydivider', isToday && 'bg-chalk-050/5')}
    >
      <div className="relative h-[60vh] min-h-[26rem]">
        {/* Chalk hairlines. */}
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
            <span className="rounded-[--radius-chip] bg-pitch-900/80 px-2 py-1 text-[0.65rem] text-chalk-050">
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
                  className="absolute inset-x-0 hover:bg-chalk-050/10 focus-visible:bg-chalk-050/15"
                  style={{
                    top: `${((slot.from - startMinute) / span) * 100}%`,
                    height: `${((slot.to - slot.from) / span) * 100}%`,
                  }}
                />
              );
            })
          : null}

        {events.map((event) => (
          <EventBlock
            key={event.id}
            event={event}
            startMinute={startMinute}
            endMinute={endMinute}
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
      className="closure-hatch pointer-events-none absolute inset-x-0 z-[5] border-y border-signal-err/60"
      style={{ top: `${((from - startMinute) / span) * 100}%`, height: `${((to - from) / span) * 100}%` }}
      title={closure.reason}
    >
      <span className="sr-only">{t('schedule.closed_banner', { reason: closure.reason })}</span>
    </div>
  );
}
