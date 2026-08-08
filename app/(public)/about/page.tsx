import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { getSettingsRow } from '@/lib/data';
import { sanitizeMemorialHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/marketing/reveal';
import { CountUp } from '@/components/marketing/count-up';
import entranceImage from '@/public/images/pitch-entrance.webp';

export const metadata: Metadata = { title: t('about.title') };
export const revalidate = 3600;

/**
 * The about page. Two columns from `lg` up, stacked below — the image leads on
 * mobile because it establishes the place faster than a paragraph does.
 *
 * The photograph is `public/images/pitch-entrance.webp`. The aspect ratio is
 * fixed by the wrapper and the image is `object-cover`, so any replacement
 * crops rather than distorts.
 */
const STATS = [
  { value: t('about.stat_1_value'), label: t('about.stat_1_label') },
  { value: t('about.stat_2_value'), label: t('about.stat_2_label') },
  { value: t('about.stat_3_value'), label: t('about.stat_3_label') },
  { value: t('about.stat_4_value'), label: t('about.stat_4_label') },
] as const;

const TIMELINE = [
  {
    year: t('about.timeline_1_year'),
    title: t('about.timeline_1_title'),
    body: t('about.timeline_1_body'),
  },
  {
    year: t('about.timeline_2_year'),
    title: t('about.timeline_2_title'),
    body: t('about.timeline_2_body'),
  },
  {
    year: t('about.timeline_3_year'),
    title: t('about.timeline_3_title'),
    body: t('about.timeline_3_body'),
  },
  {
    year: t('about.timeline_4_year'),
    title: t('about.timeline_4_title'),
    body: t('about.timeline_4_body'),
  },
] as const;

export default async function AboutPage() {
  const settings = await getSettingsRow();
  const memorialHtml = settings?.memorial_html
    ? sanitizeMemorialHtml(settings.memorial_html)
    : null;

  return (
    <>
      <section className="section">
        <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <p className="text-sm font-semibold text-primary-600">{t('about.eyebrow')}</p>
            <h1 className="mt-3 text-display">{t('about.title')}</h1>
            <p className="mt-5 text-lg text-(--ink-muted)">{t('about.lead')}</p>
            <p className="mt-5 text-(--ink-muted)">{t('about.body_1')}</p>
            <p className="mt-4 text-(--ink-muted)">{t('about.body_2')}</p>

            <Button asChild size="lg" className="mt-8">
              <Link href="/request">
                {t('about.cta')}
                <ArrowLeft className="size-5" aria-hidden />
              </Link>
            </Button>
          </Reveal>

          <Reveal className="order-1 lg:order-2">
            {/* The entrance, with the sign. This page answers "what is this
                place", and the gate carrying the name answers it faster than
                the paragraph beside it does — which is why the image leads on
                mobile and this is the one photograph that gets `priority`.

                Its alt is a plain description rather than an attempt to
                narrate the photograph. */}
            <div className="relative aspect-4/3 overflow-hidden rounded-(--radius-card) shadow-(--shadow-lg)">
              <Image
                src={entranceImage}
                alt={t('about.image_alt')}
                fill
                sizes="(min-width: 1024px) 40rem, 100vw"
                placeholder="blur"
                className="object-cover"
                priority
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Statistics. A four-up row of cards on desktop, two-up on a phone —
          never a single scrolling column, because the point of the row is the
          comparison between the numbers. */}
      <section className="pb-4">
        <div className="shell">
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="card p-5 text-center sm:p-6">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="tnum block font-display text-h1 font-bold text-primary-600">
                    <CountUp value={stat.value} />
                  </span>
                  <span className="mt-1 block text-sm text-(--ink-muted)">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The timeline. A single rule with dots on it: the vertical line is the
          only thing holding the four entries together, so it is drawn once on
          the list rather than per item. */}
      <section className="section">
        <div className="shell-narrow">
          <h2 className="text-h1">{t('about.timeline_title')}</h2>

          <ol className="relative mt-10 space-y-10 border-s border-(--hairline) ps-8">
            {TIMELINE.map((entry) => (
              <Reveal key={entry.year} as="li" className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'absolute -start-[2.03rem] top-1.5 flex size-4 items-center justify-center',
                    'rounded-full border-4 border-(--surface) bg-primary',
                  )}
                />
                <p className="tnum text-sm font-semibold text-primary-600">{entry.year}</p>
                <h3 className="mt-1 text-h3">{entry.title}</h3>
                <p className="mt-2 text-(--ink-muted)">{entry.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FR-38 / §10.6. Gilad's memorial. It used to be its own route; it now
          closes the about page, which is where visitors look for who the pitch
          is named after. The tone stays separate from the rest of the page —
          memorial rule, no colour accents, no CTA, and the wider line height of
          .memorial-prose (globals.css).

          [DECISION NEEDED — open decision #3] The final text, the portrait and
          the dedication photographs must be supplied and approved by the family
          before launch. Until the super admin saves that content in settings,
          this section shows an honest placeholder rather than invented copy. */}
      <section id="memorial" className="section scroll-mt-24">
        <article className="shell-narrow">
          <header className="border-b border-memorial/40 pb-8">
            <p className="text-sm tracking-normal text-memorial-ink">{t('memorial.title')}</p>
            <h2 className="mt-2 font-display text-h1 leading-tight">גלעד</h2>
          </header>

          {memorialHtml ? (
            <div
              className="memorial-prose mt-10"
              // The value has been through the strict allowlist in lib/sanitize.ts
              // on the way in (PATCH /api/admin/settings) and again just now.
              dangerouslySetInnerHTML={{ __html: memorialHtml }}
            />
          ) : (
            <p className="memorial-prose mt-10 text-(--ink-muted)">{t('memorial.pending')}</p>
          )}
        </article>
      </section>
    </>
  );
}
