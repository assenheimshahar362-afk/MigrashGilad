'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { t } from '@/lib/i18n';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

/**
 * §15 email + password sign-in. Registration lives on its own page,
 * `/register` — see `RegisterForm` — because the two flows ask for different
 * things (a password here, a password *and* the §2 approval acknowledgement
 * there) and a tab toggle was making that difference harder to see, not
 * easier.
 *
 * This still submits to a server route rather than calling supabase-js
 * directly: the allowlist check and the sign-out have to happen inside the
 * same request that created the session — a browser-side sign-in would leave
 * a live session for a non-admin in the gap between the two calls.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      await apiFetch('/api/auth/sign-in', {
        method: 'POST',
        json: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        },
      });
      // The session cookie was written by the route handler, so the admin
      // area is reachable on the next navigation. `refresh()` first, or the
      // client router serves the cached signed-out layout.
      router.refresh();
      router.push(next);
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 text-start">
      <div className="space-y-3">
        <LoginField id={`${id}-email`} label={t('login.email')}>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            className="text-start"
          />
        </LoginField>

        <LoginField id={`${id}-password`} label={t('login.password')}>
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            required
            dir="ltr"
            autoComplete="current-password"
            className="text-start"
          />
        </LoginField>
      </div>

      {error ? (
        <p
          role="alert"
          className="animate-rise-in mt-4 flex items-start gap-2 rounded-(--radius-input) border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
        {t('login.submit_sign_in')}
      </Button>

      <p className="mt-4 text-center text-sm text-(--ink-muted)">
        {t('login.no_account')}{' '}
        <Link href="/register" className="font-semibold text-primary-700 hover:underline">
          {t('login.register_cta')}
        </Link>
      </p>
    </form>
  );
}

function LoginField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-(--ink)">
        {label}
      </label>
      {children}
    </div>
  );
}
