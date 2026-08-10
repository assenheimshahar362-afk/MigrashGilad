import type { Metadata } from 'next';
import Image from 'next/image';
import entranceImage from '@/public/images/pitch-entrance.webp';
import { t } from '@/lib/i18n';
import { RegisterForm } from '@/components/admin/register-form';

export const metadata: Metadata = {
  title: t('register.title'),
  robots: { index: false, follow: false },
};

/**
 * §2, as amended: signing up is self-service, but being signed up grants
 * nothing — same guarantee as `/login`, split onto its own page because the
 * two forms ask for genuinely different things (§10.8a). Google and
 * email/password both end at the same gate here too: an active row in
 * `admin_allowlist` that only a super admin can create, from /admin/access.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    /* Same ground as /login — the gate photograph, dimmed, one light card. */
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
        <h1 className="font-display text-h1 text-(--ink)">{t('register.title')}</h1>
        <p className="mt-3 text-sm text-(--ink-muted)">{t('register.help')}</p>

        <RegisterForm next={sanitiseNext(params.next)} />
      </div>
    </section>
  );
}

/** An open redirect here would be a way to launder a phishing link. */
function sanitiseNext(next: string | undefined): string {
  if (!next || !next.startsWith('/admin')) return '/admin';
  return next;
}
