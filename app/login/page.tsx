import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LoginButton } from '@/components/admin/login-button';
import { LoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = {
  title: t('login.title'),
  robots: { index: false, follow: false },
};

/**
 * §2, as amended: signing up is self-service, but being signed up grants
 * nothing. Google and email/password both end at the same gate — an active row
 * in `admin_allowlist` — and a super admin is the only one who can put one
 * there, from /admin/access.
 *
 * `?status=pending` is where /auth/callback and POST /api/auth/sign-in send
 * someone whose request is filed and waiting; `?status=refused` is a decided
 * rejection. Both are stated plainly rather than dressed as an error, because
 * neither is the person's mistake.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === 'pending' || params.status === 'refused' ? params.status : null;

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

        {status ? (
          <p
            role="status"
            className={cn(
              'animate-rise-in mt-6 flex w-full items-start gap-2 rounded-(--radius-input) px-3 py-3 text-start text-sm font-semibold',
              status === 'pending'
                ? 'border border-accent/60 bg-accent/15 text-white'
                : 'border-2 border-danger bg-danger/20 text-white',
            )}
          >
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(status === 'pending' ? 'login.pending' : 'error.ERR_NOT_AUTHORIZED')}
          </p>
        ) : null}

        <LoginButton next={sanitiseNext(params.next)} />

        {/* The rule carries the word rather than sitting under it: one line of
            chrome instead of three. */}
        <div className="mt-6 flex items-center gap-3 text-xs font-semibold text-white/45">
          <span aria-hidden className="h-px flex-1 bg-white/15" />
          {t('login.or')}
          <span aria-hidden className="h-px flex-1 bg-white/15" />
        </div>

        <LoginForm next={sanitiseNext(params.next)} />

        <Link
          href="/"
          className="press-sm mt-8 inline-flex min-h-11 items-center rounded-sm text-sm text-white/80 underline decoration-white/30 underline-offset-4 transition-colors duration-(--duration-tip) ease-(--ease-out-quiet) hover:text-white hover:decoration-current"
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
