import { PartyPopper } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatDateLong, formatWeekdayLong, timeFromMinutes, minutesFromTime } from '@/lib/time';
import { TimeRange } from '@/components/ui/ltr';

/**
 * §10.3 success screen.
 *
 * There is no account and, as of this revision, no status link either: a
 * trustee follows up by phone or WhatsApp, using the number the visitor just
 * typed into the form, and marks the outcome from the admin dashboard. This
 * screen's only job is to say that plainly and hand the visitor their own
 * slot back for confirmation — there is nothing here to save, copy, or come
 * back to later.
 *
 * It carries no action either. This is a dialog over the schedule, not a page
 * the visitor navigated away to, so "back to the schedule" was offering to take
 * them somewhere they already were — the close affordances (the X, the
 * backdrop, Escape) are the whole of it.
 */
export function SuccessPanel({
  date,
  startTime,
  endTime,
}: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  return (
    <div className="space-y-6" aria-live="polite">
      <div className="text-center">
        {/* A filled disc rather than a bare icon: the confirmation is the one
            moment in the flow that is allowed to feel like an event. */}
        <span
          aria-hidden
          className="animate-rise-in mx-auto flex size-16 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-8 ring-primary-50/50"
        >
          <PartyPopper className="size-8" />
        </span>
        <h2 className="mt-5 text-h1">{t('request.success.title')}</h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-(--ink-muted)">
          {t('request.success.body')}
        </p>
      </div>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-(--ink-muted)">{t('request.success.slot')}</h3>
        <p className="mt-1 font-semibold">
          {formatWeekdayLong(date)}, {formatDateLong(date)}
        </p>
        <TimeRange
          range={`${timeFromMinutes(minutesFromTime(startTime))}–${timeFromMinutes(minutesFromTime(endTime))}`}
          className="mt-1 block text-h3"
        />
      </section>
    </div>
  );
}
