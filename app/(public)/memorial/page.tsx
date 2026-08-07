import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getSettingsRow } from '@/lib/data';
import { sanitizeMemorialHtml } from '@/lib/sanitize';

export const metadata: Metadata = { title: t('memorial.title') };
export const revalidate = 3600;

/**
 * FR-38 / §10.6. A dedicated page for Gilad.
 *
 * G5: the site is a dignified memorial, not a generic booking tool. This page
 * carries that on its own — no booking UI, no bottom CTA, no colour accents
 * except the memorial tone, wider margins and larger line height than anywhere
 * else in the product (.memorial-prose in globals.css).
 *
 * [DECISION NEEDED — open decision #3] The final text, the portrait and the
 * dedication photographs must be supplied and approved by the family before
 * launch. Until the super admin saves that content in settings, this page shows
 * an honest placeholder rather than invented copy.
 */
export default async function MemorialPage() {
  const settings = await getSettingsRow();
  const html = settings?.memorial_html ? sanitizeMemorialHtml(settings.memorial_html) : null;

  return (
    <article className="mx-auto max-w-[720px] px-6 py-12 pb-24">
      <header className="border-b border-memorial/40 pb-8">
        <p className="text-sm tracking-normal text-memorial">{t('memorial.title')}</p>
        <h1 className="mt-2 font-display text-display leading-tight">גלעד</h1>
      </header>

      {html ? (
        <div
          className="memorial-prose mt-10"
          // The value has been through the strict allowlist in lib/sanitize.ts
          // on the way in (PATCH /api/admin/settings) and again just now.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="memorial-prose mt-10 text-[--ink-muted]">{t('memorial.pending')}</p>
      )}
    </article>
  );
}
