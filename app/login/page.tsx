import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { LoginButton } from '@/components/admin/login-button';

export const metadata: Metadata = {
  title: t('login.title'),
  robots: { index: false, follow: false },
};

/**
 * §2: there is no self-service admin signup, and no "sign in" affordance
 * anywhere in the public UI. The only route here is by typing the URL or
 * following an admin's bookmark — which is why this page is not in the tab bar,
 * the footer, or the sitemap.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="font-display text-h1">{t('login.title')}</h1>
      <p className="mt-3 text-sm text-[--ink-muted]">{t('login.help')}</p>

      {params.error ? (
        <p
          role="alert"
          className="mt-6 w-full rounded-[--radius-input] border-2 border-signal-err bg-signal-err/10 px-3 py-2 text-sm font-semibold"
        >
          {t('error.ERR_NOT_AUTHORIZED')}
        </p>
      ) : null}

      <LoginButton next={sanitiseNext(params.next)} />

      <Link href="/" className="mt-8 text-sm underline underline-offset-4">
        {t('common.back_home')}
      </Link>
    </main>
  );
}

/** An open redirect here would be a way to launder a phishing link. */
function sanitiseNext(next: string | undefined): string {
  if (!next || !next.startsWith('/admin')) return '/admin';
  return next;
}
