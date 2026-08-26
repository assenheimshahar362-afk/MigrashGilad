import { Goal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { formatTimeRange, type LocalDate } from '@/lib/time';
import { clusterOverlappingEvents, eventsWithCommunityFill, hoursForDate } from '@/lib/schedule';
import { eventDisplayTitle, type PublicEvent, type PublicSettings } from '@/lib/types';
import { eventStyle } from '@/lib/usage-type';
import { TimeRange } from '@/components/ui/ltr';
import { EventDetailTrigger } from '@/components/schedule/event-detail-trigger';

/**
 * The day view: one card per booking, full width and large enough to read at
 * a glance, instead of the week grid's absolutely-positioned columns. It is
 * built on the same data the grid uses (`eventsWithCommunityFill`,
 * `clusterOverlappingEvents`) so the two views can never silently disagree
 * about what is actually booked — they are two renderings of one list, not
 * two lists.
 *
 * A cluster of exactly two differently-typed events — association and
 * community sharing the pitch half each — gets its own merged card
 * (`CombinedCard`) rather than being stacked as two separate ones: that IS
 * what is happening in that slot, and showing it as two unrelated bookings
 * would misdescribe it.
 */
export function DayView({
  date,
  events,
  settings,
}: {
  date: LocalDate;
  events: PublicEvent[];
  settings: PublicSettings;
}) {
  const dayHours = hoursForDate(settings.openingHours, date);

  if (!dayHours) {
    return (
      <div className="closure-hatch rounded-(--radius-card) border border-(--hairline) px-4 py-10 text-center">
        <span className="rounded-(--radius-chip) bg-(--surface-raised) px-3 py-1.5 text-sm font-semibold text-danger-ink shadow-(--shadow-xs) ring-1 ring-danger/25">
          {t('schedule.closed_day')}
        </span>
      </div>
    );
  }

  const dayEvents = eventsWithCommunityFill(events, date, settings.openingHours) ?? [];
  const clusters = clusterOverlappingEvents(dayEvents);

  if (clusters.length === 0) {
    return <p className="empty-state">{t('schedule.day_empty')}</p>;
  }

  return (
    <ul className="stagger space-y-3">
      {clusters.map((cluster) => {
        const [first, second] = cluster;
        const isCombined = first && second && cluster.length === 2 && first.usageType !== second.usageType;
        return (
          <li key={first?.id}>
            {isCombined ? (
              <CombinedCard events={[first, second]} />
            ) : (
              <div className="space-y-3">
                {cluster.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const style = eventStyle(event.title, event.usageType);
  const range = formatTimeRange(event.startsAt, event.endsAt);
  const title = eventDisplayTitle(event);
  // A synthesized community-time filler (or any event whose title is just
  // its own type label) has nothing further to say for a heading — see
  // `event-block.tsx` for the same rule on the grid.
  const showTitle = title !== style.label;
  const description = event.description ?? communityFallback(event);

  return (
    <EventDetailTrigger
      event={event}
      className={cn(
        'press-sm block w-full cursor-pointer rounded-(--radius-card) px-5 py-4 text-start shadow-(--shadow-sm)',
        'transition-[box-shadow,transform] duration-(--duration-press) ease-(--ease-out-quiet)',
        'hover:shadow-(--shadow-md) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        style.block,
        style.patternClass,
      )}
    >
      <TimeRange range={range} className="text-sm font-semibold text-(--ink-muted)" />
      <div className="mt-1.5 flex items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', style.bar)} aria-hidden />
        <p className="text-lg font-bold">{style.label}</p>
      </div>
      {showTitle ? <p className="mt-1 font-semibold">{title}</p> : null}
      {description ? <p className="mt-1 text-sm text-(--ink-muted)">{description}</p> : null}
    </EventDetailTrigger>
  );
}

function CombinedCard({ events }: { events: [PublicEvent, PublicEvent] }) {
  const range = formatTimeRange(events[0].startsAt, events[0].endsAt);

  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-(--hairline) shadow-(--shadow-sm)">
      <div className="flex items-center gap-3 bg-(--surface-raised) px-5 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--surface-sunken) text-(--ink)"
          aria-hidden
        >
          <Goal className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold">{t('usage.combined')}</p>
          <TimeRange range={range} className="text-sm text-(--ink-muted)" />
        </div>
      </div>

      {/* Two halves, one pitch: this is a single slot split between the two
          categories, not two separate bookings, so it reads as one card with
          an internal divider rather than two stacked ones. The divider is
          `border-e` on the leading half only — a logical property, so it
          lands on the correct side under `dir="rtl"` without a second rule
          (same reasoning as `event-block.tsx`'s leading edge). */}
      <div className="grid grid-cols-2">
        {events.map((event, index) => (
          <CombinedHalf key={event.id} event={event} isFirst={index === 0} />
        ))}
      </div>
    </div>
  );
}

function CombinedHalf({ event, isFirst }: { event: PublicEvent; isFirst: boolean }) {
  const style = eventStyle(event.title, event.usageType);
  const title = eventDisplayTitle(event);
  const showTitle = title !== style.label;
  const description = event.description ?? communityFallback(event);

  return (
    <EventDetailTrigger
      event={event}
      className={cn(
        'block w-full cursor-pointer px-4 py-3 text-start',
        'transition-[filter] duration-(--duration-tip) ease-(--ease-out-quiet) hover:brightness-[0.97]',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        isFirst && 'border-e border-(--hairline)',
        style.block,
        style.patternClass,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('size-2 shrink-0 rounded-full', style.bar)} aria-hidden />
        <p className="text-xs font-semibold text-(--ink-muted)">{t('schedule.half_field')}</p>
      </div>
      <p className="mt-1 truncate font-bold">{showTitle ? title : style.label}</p>
      {description ? <p className="mt-0.5 truncate text-xs text-(--ink-muted)">{description}</p> : null}
    </EventDetailTrigger>
  );
}

/** Unbooked community time has no admin-written description — a plain,
 *  reassuring default stands in so the card never has an empty third line. */
function communityFallback(event: PublicEvent): string | null {
  return event.usageType === 'community' ? t('schedule.community_free_text') : null;
}
