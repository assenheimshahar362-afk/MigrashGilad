import type { Metadata } from 'next';
import Image from 'next/image';
import { t } from '@/lib/i18n';
import { Reveal } from '@/components/marketing/reveal';
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
export default function AboutPage() {
  return (
    <section className="section">
      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <p className="text-sm font-semibold text-primary-600">{t('about.eyebrow')}</p>
          <h1 className="mt-3 text-display">{t('about.title')}</h1>
          <p className="mt-5 text-lg text-(--ink-muted)">{t('about.lead')}</p>
          <p className="mt-5 text-(--ink-muted)">{t('about.body_1')}</p>
          <p className="mt-4 text-(--ink-muted)">{t('about.body_2')}</p>
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
  );
}
