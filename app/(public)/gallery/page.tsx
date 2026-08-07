import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { t } from '@/lib/i18n';
import { GalleryGrid, type GalleryItem } from '@/components/marketing/gallery-grid';

export const metadata: Metadata = { title: t('gallery.title') };

/**
 * The gallery.
 *
 * Every image here is a locally generated placeholder from
 * `public/images/gallery-*.svg`. Replace the files (keeping the names) or
 * replace this array — nothing else needs to change. The notice below is
 * rendered so the placeholders are never mistaken for the real thing in review;
 * delete it along with the placeholders.
 */
const ITEMS: GalleryItem[] = [
  { src: '/images/gallery-1.svg', caption: t('gallery.item_1') },
  { src: '/images/gallery-2.svg', caption: t('gallery.item_2') },
  { src: '/images/gallery-3.svg', caption: t('gallery.item_3'), tall: true },
  { src: '/images/gallery-4.svg', caption: t('gallery.item_4') },
  { src: '/images/gallery-5.svg', caption: t('gallery.item_5') },
  { src: '/images/gallery-6.svg', caption: t('gallery.item_6'), tall: true },
  { src: '/images/gallery-7.svg', caption: t('gallery.item_7') },
  { src: '/images/gallery-8.svg', caption: t('gallery.item_8') },
];

export default function GalleryPage() {
  return (
    <section className="section">
      <div className="shell">
        <p className="text-sm font-semibold text-primary-600">{t('gallery.eyebrow')}</p>
        <h1 className="mt-3 text-display">{t('gallery.title')}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-(--ink-muted)">{t('gallery.lead')}</p>

        <p className="mt-6 flex items-start gap-2.5 rounded-(--radius-card-sm) border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('gallery.placeholder_notice')}
        </p>

        <div className="mt-8">
          <GalleryGrid items={ITEMS} />
        </div>
      </div>
    </section>
  );
}
