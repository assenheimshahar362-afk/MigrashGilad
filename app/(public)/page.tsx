import Image from 'next/image';
import type { Metadata } from 'next';
import { MapPin, Clock } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getSchedule, getSettings, getTrustees } from '@/lib/data';
import {
  addLocalDays,
  formatWeekRange,
  localWeekDays,
  startOfLocalWeek,
  todayLocal,
  type LocalDate,
} from '@/lib/time';
import { WeekGrid } from '@/components/schedule/week-grid';
import { WeekNav } from '@/components/schedule/week-nav';
import { WeekSwipe } from '@/components/schedule/week-swipe';
import { DayList } from '@/components/schedule/day-list';
import { DayStrip } from '@/components/schedule/day-strip';
import { DayView } from '@/components/schedule/day-view';
import { ViewToggle } from '@/components/schedule/view-toggle';
import { Legend } from '@/components/schedule/legend';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { Hero } from '@/components/marketing/hero';
import { Reveal } from '@/components/marketing/reveal';
import { TrusteeCard } from '@/components/trustees/trustee-card';
import { TrusteeContactGrid } from '@/components/trustees/trustee-contact-grid';
import entranceImage from '@/public/images/pitch-entrance.webp';
import type { TrusteeRow } from '@/lib/types';

export const metadata: Metadata = {
  title: t('schedule.title'),
};

/**
 * The whole public site, one page. FR-7: the calendar is readable with no
 * login and no JavaScript-blocking auth check — it is server-rendered and
 * cached (NFR-3), and the only client JavaScript on this route is the
 * now-marker, the legend toggle and the week-swipe handler — none of which
 * the content depends on.
 *
 * G1: the calendar is the landing screen. A visitor should know who has the
 * pitch this week in under five seconds, without tapping anything.
 *
 * What used to be six routes (/request, /about, /trustees, /contact, /rules,
 * /accessibility) are down to three still living here as `<section id="…">`
 * anchors — /about, /trustees, /contact — with the header, footer and bottom
 * tab bar linking to `/#id` for those. The other three moved back to being
 * real routes, by product request: /request is now a floating modal rather
 * than a page at all (`components/request/request-modal.tsx`), mounted once
 * in the public layout so it opens the same way from every public route;
 * /rules and /accessibility (`app/(public)/rules`,
 * `app/(public)/accessibility`) are ordinary pages again, each with its own
 * <h1>. Along with the admin/manager area, that is everything left with its
 * own route — the admin area being a genuinely different application behind
 * auth.
 *
 * The month view had a route here too and no longer does: the calendar is the
 * week grid and the day view, both of them on THIS page and both reachable
 * from the toggle above the grid, so a third shape on a page of its own was
 * one more place the same bookings could be read from. `/schedule/month`
 * permanent-redirects here (§ next.config.ts).
 */
export const revalidate = 300;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; date?: string }>;
}) {
  const params = await searchParams;

  // FR-6: the week lives in the URL so it can be shared. An unparseable value
  // falls back to this week rather than erroring — a bad link should still show
  // the visitor something useful.
  const requested = parseLocalDate(params.week);
  const weekStart = startOfLocalWeek(requested ?? todayLocal());
  const weekEnd = addLocalDays(weekStart, 6);

  const [{ events }, settings, trustees] = await Promise.all([
    getSchedule(weekStart, weekEnd),
    getSettings(),
    getTrustees(),
  ]);

  const days = localWeekDays(weekStart);
  const isEmpty = events.length === 0;

  // Day view's own state: which of the two shapes of this same week's data to
  // show, and — for the day shape — which single day. `date` falls back to
  // today when this week contains it, otherwise the week's first day, which
  // is the same default `<DayStrip>` highlights.
  const view = params.view === 'day' ? 'day' : 'week';
  const today = todayLocal();
  const requestedDate = parseLocalDate(params.date);
  const selectedDate = requestedDate && days.includes(requestedDate)
    ? requestedDate
    : (days.includes(today) ? today : weekStart);

  // The two weeks a swipe can reach (§ week-swipe.tsx). Built exactly the way
  // `<WeekNav>` builds its chevrons' hrefs — a swipe and a tap on the arrow it
  // stands in for must land on the same URL, including staying in day view.
  const weekHref = (target: LocalDate) =>
    view === 'day' ? `/?view=day&week=${target}` : `/?week=${target}`;

  return (
    <>
      <Hero />

      <section id="schedule" className="scroll-mt-24 pb-28 lg:pb-16">
        <div className="shell pt-8 sm:pt-10 lg:pt-14">
          {/* The hero carries this page's <h1>; every section below is a
              sibling of it, not a nested subtopic, so each gets its own <h2>
              rather than compounding the hierarchy. Visually the week range
              in <WeekNav> is the heading here, so this one is for the
              accessibility tree only. */}
          <h2 className="sr-only">
            {t('schedule.title')} - {t('schedule.week_of', { range: formatWeekRange(weekStart) })}
          </h2>

          <OfflineBanner />

          {/* FR-6: swipe left/right anywhere on the calendar — the nav strip
              and the grid or day cards below it — to change the week. The
              chevrons inside `<WeekNav>` do the same thing for anyone not on a
              touch device. */}
          <WeekSwipe
            weekStart={weekStart}
            prevHref={weekHref(addLocalDays(weekStart, -7))}
            nextHref={weekHref(addLocalDays(weekStart, 7))}
          >
            <WeekNav weekStart={weekStart} view={view} date={selectedDate} />

            <div className="mb-4 flex justify-center">
              <ViewToggle view={view} week={weekStart} date={selectedDate} />
            </div>

            {view === 'week' ? (
              /* The same grid at every width — a phone gets the identical
                 seven-day layout as a desktop, just narrower, rather than a
                 different, simplified view. `WeekGrid` shrinks its own columns
                 and axis to fit; nothing here scrolls sideways. */
              <div>
                <WeekGrid weekStart={weekStart} events={events} settings={settings} />

                {/* A11Y-5: the screen-reader alternative to the grid — the grid
                    conveys time by absolute position, which a screen reader
                    cannot narrate. */}
                <DayList dates={days} events={events} headingId="week-sr-list" />
              </div>
            ) : (
              /* Day view's cards are ordinary flowed text, not absolutely
                 positioned like the grid's blocks — they need no separate
                 screen-reader list the way the grid does. */
              <div>
                <DayStrip days={days} selectedDate={selectedDate} weekStart={weekStart} />
                <div className="mt-4">
                  <DayView date={selectedDate} events={events} settings={settings} />
                </div>
              </div>
            )}
          </WeekSwipe>

          <div className="mt-4">
            <Legend />
          </div>

          {isEmpty && view === 'week' ? <p className="empty-state mt-4">{t('schedule.empty')}</p> : null}
        </div>
      </section>

      <AboutSection />
      <TrusteesSection trustees={trustees} />
      <ContactSection trustees={trustees} />
    </>
  );
}

/** Shared by the `week` and `date` search params — both are plain local
 *  dates. An unparseable value returns `null` rather than throwing: a bad
 *  link should still show the visitor something useful (§ HomePage above). */
function parseLocalDate(value: string | undefined): LocalDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? null : value;
}

/**
 * The about section. Two columns from `lg` up, stacked below — the image
 * leads on mobile because it establishes the place faster than a paragraph
 * does.
 */
function AboutSection() {
  return (
    <section id="about" className="section scroll-mt-24 border-t border-(--hairline)">
      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <p className="text-sm font-semibold text-primary-600">{t('about.eyebrow')}</p>
          <h2 className="mt-3 text-display">{t('about.title')}</h2>
          <p className="mt-5 text-(--ink-muted)">{t('about.lead')}</p>
          <p className="mt-5 text-(--ink-muted)">{t('about.body_1')}</p>
          <p className="mt-4 text-(--ink-muted)">{t('about.body_2')}</p>
          <p className="mt-4 text-(--ink-muted)">{t('about.body_3')}</p>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          {/* The entrance, with the sign. This section answers "what is this
              place", and the gate carrying the name answers it faster than
              the paragraph beside it does — which is why the image leads on
              mobile. Its alt is a plain description rather than an attempt
              to narrate the photograph. */}
          <div className="relative aspect-4/3 overflow-hidden rounded-(--radius-card) shadow-(--shadow-lg)">
            <Image
              src={entranceImage}
              alt={t('about.image_alt')}
              fill
              sizes="(min-width: 1024px) 40rem, 100vw"
              placeholder="blur"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * FR-27 / §10.5. Ordered by `display_order` (FR-29). The grid tops out at
 * three columns rather than four: these are people, and four-up shrinks each
 * card to the point where the name is the only thing left on it.
 */
function TrusteesSection({ trustees }: { trustees: TrusteeRow[] }) {
  return (
    <section id="trustees" className="section scroll-mt-24 border-t border-(--hairline)">
      <div className="shell">
        <h2 className="text-display">{t('trustees.title')}</h2>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('trustees.intro')}</p>

        {trustees.length === 0 ? (
          <p className="empty-state mt-10">{t('trustees.empty')}</p>
        ) : (
          <ul className="stagger mt-10 grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {trustees.map((trustee) => (
              <TrusteeCard key={trustee.id} trustee={trustee} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The map is a live embed, not a placeholder — it needs no API key since it
 * goes through the plain `output=embed` endpoint, and `frame-src` in
 * next.config.ts allows exactly this one origin.
 */
function ContactSection({ trustees }: { trustees: TrusteeRow[] }) {
  return (
    <section id="contact" className="section scroll-mt-24 border-t border-(--hairline)">
      <div className="shell">
        <p className="text-sm font-semibold text-primary-600">{t('contact.eyebrow')}</p>
        <h2 className="mt-3 text-display">{t('contact.title')}</h2>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('contact.lead')}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          {/* Who to contact, where, and when — three answers to the same
              question, so they used to live in three separate cards. One
              border around all of them reads as a single answer instead of
              three competing facts. */}
          <div className="card p-6 sm:p-7">
            {/* One circle per trustee, so a tap reaches a person rather than
                a page — the choice of call or WhatsApp happens in the sheet,
                once a name is picked. */}
            <h3 className="text-h3">{t('contact.trustees_title')}</h3>

            {trustees.length > 0 ? (
              <div className="mt-4">
                <TrusteeContactGrid trustees={trustees} />
              </div>
            ) : (
              <p className="mt-3 text-(--ink-muted)">{t('contact.no_trustee')}</p>
            )}

            <div className="mt-6 grid gap-5 border-t border-(--hairline) pt-6 sm:grid-cols-2">
              <InfoRow icon={<MapPin className="size-5" />} label={t('contact.address')}>
                {t('contact.address_value')}
              </InfoRow>
              <InfoRow icon={<Clock className="size-5" />} label={t('contact.hours')}>
                {t('contact.hours_value')}
              </InfoRow>
            </div>
          </div>

          <div className="card relative overflow-hidden">
            {/* The embed's own UI already has an "open in Google Maps"
                affordance (the place-name link inside the frame), so no
                overlay button duplicates it here. */}
            <iframe
              title={t('contact.map_title')}
              src="https://www.google.com/maps?q=%D7%A7%D7%99%D7%91%D7%95%D7%A5+%D7%92%D7%A0%D7%99%D7%92%D7%A8&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="min-h-[22rem] w-full border-0 lg:min-h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A row rather than its own card — this now sits inside the unified contact
 * card alongside the trustee grid, so a second border here would compete
 * with the one already around it instead of reading as part of the same
 * answer.
 */
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-input) bg-primary-50 text-primary-600"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-(--ink-muted)">{label}</h4>
        <p className="font-semibold">{children}</p>
      </div>
    </div>
  );
}

