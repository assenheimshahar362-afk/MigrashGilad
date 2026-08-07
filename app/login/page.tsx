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
    /* The sign-in screen is the one place a visitor should never arrive by
       accident, so it does not wear the public chrome at all — it is a single
       card on the deep turf, which reads as a back door rather than a page. */
    <main
      id="main"
      className="pitch-field flex min-h-dvh flex-col items-center justify-center px-6 py-10"
    >
      <div className="animate-rise-in w-full max-w-[26rem] rounded-(--radius-card) border border-white/10 bg-primary-900/95 p-8 text-center shadow-[0_24px_70px_-20px_rgb(0_0_0/0.7)] backdrop-blur-md">
        <h1 className="font-display text-h1 text-white">{t('login.title')}</h1>
        <p className="mt-3 text-sm text-white/80">{t('login.help')}</p>

        {params.error ? (
          <p
            role="alert"
            className="animate-rise-in mt-6 w-full rounded-(--radius-input) border-2 border-danger bg-danger/20 px-3 py-2 text-sm font-semibold text-white"
          >
            {t('error.ERR_NOT_AUTHORIZED')}
          </p>
        ) : null}

        <LoginButton next={sanitiseNext(params.next)} />

        <Link
          href="/"
          className="press-sm mt-8 inline-block rounded-sm text-sm text-white/80 underline decoration-white/30 underline-offset-4 transition-colors duration-(--duration-tip) ease-(--ease-out-quiet) hover:text-white hover:decoration-current"
        >
          {t('common.back_home')}
        </Link>
      </div>
    </main>
  );
}

/** An open redirect here would be a way to launder a phishing link. */
function sanitiseNext(next: string | undefined): string {
  if (!next || !next.startsWith('/admin')) return '/admin';
  return next;
}
