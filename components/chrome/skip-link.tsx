import { t } from '@/lib/i18n';

/** A11Y-4: keyboard users must be able to get past the chrome in one press. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-(--radius-input) focus:bg-accent focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-800"
    >
      {t('nav.skip_to_content')}
    </a>
  );
}
