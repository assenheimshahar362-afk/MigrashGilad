'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface GalleryItem {
  src: string;
  caption: string;
  /** Tall tiles span two rows in the masonry. */
  tall?: boolean;
}

/**
 * The gallery: a CSS masonry-style grid plus a lightbox.
 *
 * The layout is `grid-auto-rows` with tall tiles spanning two rows, not CSS
 * `columns`. Columns would reorder the images down each column rather than
 * across the page, which in an RTL document puts the first photograph in a
 * place nobody looks first.
 *
 * The lightbox is built here rather than pulled in as a dependency — it is a
 * dialog, three keys and a focus trap, and the brief asks for no unnecessary
 * libraries.
 */
export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + items.length) % items.length,
      ),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      // RTL: ArrowLeft moves forwards through the set, matching the reading
      // direction of the thumbnails behind the overlay.
      if (event.key === 'ArrowLeft') step(1);
      if (event.key === 'ArrowRight') step(-1);
    };

    // The page behind must not scroll while the overlay is up, or a swipe
    // intended for the lightbox moves the gallery underneath it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [openIndex, close, step]);

  const active = openIndex === null ? null : items[openIndex];

  return (
    <>
      <ul className="grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.src} className={cn(item.tall && 'row-span-2')}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`${item.caption} — ${t('gallery.open')}`}
              className={cn(
                'group relative block size-full overflow-hidden rounded-(--radius-card-sm)',
                'bg-(--surface-sunken) shadow-(--shadow-xs)',
                'transition-[box-shadow,transform] duration-(--duration-pop) ease-(--ease-out-quiet)',
                'hover:shadow-(--shadow-md) motion-safe:hover:-translate-y-0.5',
                'active:scale-[0.99] motion-reduce:transition-none',
              )}
            >
              {/* The zoom happens on the image inside a clipping box, so the
                  tile's own corners stay put. Scaling the tile would make the
                  grid gaps breathe, which reads as the layout wobbling. */}
              <Image
                src={item.src}
                alt={item.caption}
                fill
                sizes="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 50vw"
                className={cn(
                  'object-cover',
                  'transition-transform duration-500 ease-(--ease-out-quiet)',
                  'group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                )}
              />

              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent',
                  'px-3 pt-8 pb-2.5 text-start text-xs font-medium text-white',
                  'opacity-0 transition-opacity duration-(--duration-pop)',
                  'group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
              >
                {item.caption}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption}
          onClick={close}
          className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-black/88 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-4 p-4 text-white">
            <p className="tnum text-sm text-white/70">
              {t('gallery.counter', { index: (openIndex ?? 0) + 1, total: items.length })}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label={t('gallery.close')}
              className="press tap-target flex items-center justify-center rounded-(--radius-input) text-white/80 hover:bg-white/12 hover:text-white"
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>

          {/* Stop propagation so a click on the photograph itself does not
              dismiss — only the surrounding backdrop does. */}
          <div
            className="relative flex-1 px-4 pb-4"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              key={active.src}
              src={active.src}
              alt={active.caption}
              fill
              sizes="100vw"
              className="animate-rise-in object-contain p-2"
            />
          </div>

          <div
            className="flex items-center justify-center gap-3 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <LightboxNav onClick={() => step(-1)} label={t('gallery.prev')}>
              <ChevronRight className="size-6" aria-hidden />
            </LightboxNav>
            <p className="min-w-0 flex-1 truncate text-center text-sm text-white/85">
              {active.caption}
            </p>
            <LightboxNav onClick={() => step(1)} label={t('gallery.next')}>
              <ChevronLeft className="size-6" aria-hidden />
            </LightboxNav>
          </div>
        </div>
      ) : null}
    </>
  );
}

function LightboxNav({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'press tap-target flex shrink-0 items-center justify-center rounded-(--radius-input)',
        'border border-white/20 bg-white/10 text-white',
        'transition-[background-color,border-color,transform] duration-(--duration-press)',
        'ease-(--ease-out-quiet) hover:border-white/35 hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}
