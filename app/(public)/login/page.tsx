import type { Metadata } from 'next';
import Image from 'next/image';
import { Clock3 } from 'lucide-react';
import entranceImage from '@/public/images/pitch-entrance.webp';
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
    /* The screen wears the public chrome like every other page — the header,
       the tab bar and the footer are all still there. What sets it apart is
       the ground it stands on: the photograph of the gate, dimmed, with a white
       card on top. The card is the only light surface in the frame, so the eye
       has exactly one place to go.

       The section carries its own background rather than the layout's, so this
       is the only route that pays for the photograph. */
    <section className="relative isolate flex min-h-[calc(100dvh-var(--header-h))] flex-col items-center justify-center px-6 py-12">
      <div aria-hidden className="absolute inset-0 -z-20 bg-primary-900">
        <Image
          src={entranceImage}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          className="object-cover object-center"
        />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary-900/70" />

      <div className="animate-rise-in w-full max-w-[26rem] rounded-(--radius-card) border border-(--hairline) bg-(--surface-raised) p-8 text-center shadow-[0_24px_70px_-20px_rgb(0_0_0/0.55)]">
        <h1 className="font-display text-h1 text-(--ink)">{t('login.title')}</h1>
        <p className="mt-3 text-sm text-(--ink-muted)">{t('login.help')}</p>

        {params.error ? (
          <p
            role="alert"
            className="animate-rise-in mt-6 w-full rounded-(--radius-input) border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger-ink"
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
                ? 'border border-accent bg-accent/12 text-accent-ink'
                : 'border-2 border-danger bg-danger/10 text-danger-ink',
            )}
          >
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(status === 'pending' ? 'login.pending' : 'error.ERR_NOT_AUTHORIZED')}
          </p>
        ) : null}

        <LoginButton next={sanitiseNext(params.next)} />

        {/* The rule carries the word rather than sitting under it: one line of
            chrome instead of three. */}
        <div className="mt-6 flex items-center gap-3 text-xs font-semibold text-(--ink-faint)">
          <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
          {t('login.or')}
          <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
        </div>

        <LoginForm next={sanitiseNext(params.next)} />
      </div>
    </section>
  );
}

/**
 * An open redirect here would be a way to launder a phishing link, so only an
 * `/admin/...` path is ever honoured — and only because it means someone was
 * bounced here from a protected page they were actually trying to reach.
 * Arriving at /login with no such target (the ordinary case: someone clicked
 * the sign-in icon) lands back on the public home page, not the dashboard —
 * signing in should not, by itself, drop a manager into /admin with no way
 * back out except signing out again.
 */
function sanitiseNext(next: string | undefined): string {
  if (!next || !next.startsWith('/admin')) return '/';
  return next;
}
