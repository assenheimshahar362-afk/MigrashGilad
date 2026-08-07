import Link from 'next/link';
import { t } from '@/lib/i18n';

/** §3: footer with the accessibility statement link, which A11Y-9 requires to
 *  be reachable from every page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[--hairline] px-4 py-6 text-sm text-[--ink-muted]">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/rules" className="underline underline-offset-4 hover:text-[--ink]">
          {t('nav.rules')}
        </Link>
        <Link href="/trustees" className="underline underline-offset-4 hover:text-[--ink]">
          {t('nav.trustees')}
        </Link>
        <Link href="/accessibility" className="underline underline-offset-4 hover:text-[--ink]">
          {t('nav.accessibility')}
        </Link>
        <span className="ms-auto">{t('app.name')}</span>
      </div>
    </footer>
  );
}
