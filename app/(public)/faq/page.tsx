import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, MessageCircleQuestion } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: t('faq.title') };

/**
 * The FAQ.
 *
 * Built on <details>/<summary> rather than a JavaScript accordion: it is
 * keyboard-operable, announced correctly, searchable by the browser's find-in-
 * page (which expands the matching panel automatically in Chrome), and works
 * with no client bundle at all. `interpolate-size: allow-keywords` plus a
 * `height` transition on `::details-content` gives the open/close animation in
 * browsers that support it, and a plain instant toggle everywhere else — which
 * is the correct degradation, not a broken one.
 */
const ITEMS = [
  { q: t('faq.q1'), a: t('faq.a1') },
  { q: t('faq.q2'), a: t('faq.a2') },
  { q: t('faq.q3'), a: t('faq.a3') },
  { q: t('faq.q4'), a: t('faq.a4') },
  { q: t('faq.q5'), a: t('faq.a5') },
  { q: t('faq.q6'), a: t('faq.a6') },
  { q: t('faq.q7'), a: t('faq.a7') },
  { q: t('faq.q8'), a: t('faq.a8') },
] as const;

export default function FaqPage() {
  return (
    <section className="section">
      <div className="shell-narrow">
        <p className="text-sm font-semibold text-primary-600">{t('faq.eyebrow')}</p>
        <h1 className="mt-3 text-display">{t('faq.title')}</h1>
        <p className="mt-4 text-lg text-(--ink-muted)">{t('faq.lead')}</p>

        <div className="mt-10 space-y-3">
          {ITEMS.map((item) => (
            <details
              key={item.q}
              name="faq"
              className="faq-item card group px-5 py-1 [&[open]]:border-(--hairline-strong)"
            >
              <summary
                className={cn(
                  'flex cursor-pointer list-none items-center justify-between gap-4 py-4',
                  'text-start font-semibold text-(--ink) [&::-webkit-details-marker]:hidden',
                  'rounded-(--radius-input) transition-colors duration-(--duration-tip)',
                  'hover:text-primary-700',
                )}
              >
                {item.q}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-5 shrink-0 text-(--ink-faint)',
                    'transition-transform duration-(--duration-pop) ease-(--ease-out-quiet)',
                    'group-open:rotate-180 motion-reduce:transition-none',
                  )}
                />
              </summary>
              <div className="pb-5 text-(--ink-muted)">{item.a}</div>
            </details>
          ))}
        </div>

        {/* The escape hatch. An FAQ that does not offer a person at the end is
            a wall, not an answer. */}
        <div className="card mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-(--radius-input) bg-primary-50 text-primary-600"
          >
            <MessageCircleQuestion className="size-6" />
          </span>
          <p className="flex-1 font-semibold">{t('faq.still_stuck')}</p>
          <Button asChild variant="secondary">
            <Link href="/contact">{t('nav.contact')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
