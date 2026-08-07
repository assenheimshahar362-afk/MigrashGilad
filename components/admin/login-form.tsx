'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, MailCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';

type Mode = 'sign_in' | 'sign_up';

/**
 * §2 email + password, the second way in beside Google.
 *
 * Both submit to server route handlers rather than calling supabase-js from
 * here. That is what lets the allowlist check and the sign-out happen inside
 * the same request that created the session — a browser-side sign-in would
 * leave a live session for a non-admin in the gap between the two calls.
 *
 * The form lives on the dark card, so it does not reuse `Field`/`Input` from
 * components/ui: those are drawn for the light surfaces of the public site,
 * and a dark-on-dark label is worse than a few local classes.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<Mode>('sign_in');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      if (mode === 'sign_up') {
        await apiFetch('/api/auth/sign-up', {
          method: 'POST',
          json: {
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
            fullName: String(form.get('fullName') ?? ''),
          },
        });
        setSent(true);
      } else {
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
      }
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-rise-in mt-6 rounded-(--radius-input) border border-white/15 bg-white/8 p-5 text-start">
        <p className="flex items-center gap-2 font-semibold text-white">
          <MailCheck className="size-5 shrink-0 text-accent" aria-hidden />
          {t('login.check_email')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{t('login.check_email_body')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 text-start">
      {/* Two modes, one form. A tab pair rather than a link that swaps the
          page: the fields are the same and reloading would throw away what has
          already been typed. */}
      <div
        role="tablist"
        aria-label={t('login.title')}
        className="flex gap-1 rounded-(--radius-input) bg-white/10 p-1"
      >
        {(['sign_in', 'sign_up'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={cn(
              'press min-h-11 flex-1 rounded-[calc(var(--radius-input)-0.25rem)] px-3 text-sm font-semibold',
              'transition-[background-color,color] duration-(--duration-tip) ease-(--ease-out-quiet)',
              mode === value ? 'bg-white text-primary-800' : 'text-white/75 hover:text-white',
            )}
          >
            {t(value === 'sign_in' ? 'login.tab_sign_in' : 'login.tab_sign_up')}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === 'sign_up' ? (
          <LoginField id={`${id}-name`} label={t('login.full_name')}>
            <input
              id={`${id}-name`}
              name="fullName"
              type="text"
              required
              autoComplete="name"
              minLength={2}
              maxLength={80}
              className={loginInputClass}
            />
          </LoginField>
        ) : null}

        <LoginField id={`${id}-email`} label={t('login.email')}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            className={cn(loginInputClass, 'text-start')}
          />
        </LoginField>

        <LoginField
          id={`${id}-password`}
          label={t('login.password')}
          hint={mode === 'sign_up' ? t('login.password_hint') : undefined}
        >
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            required
            dir="ltr"
            minLength={mode === 'sign_up' ? 8 : undefined}
            autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
            className={cn(loginInputClass, 'text-start')}
          />
        </LoginField>
      </div>

      {error ? (
        <p
          role="alert"
          className="animate-rise-in mt-4 flex items-start gap-2 rounded-(--radius-input) border border-danger/60 bg-danger/20 px-3 py-2 text-sm font-semibold text-white"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
        {t(mode === 'sign_in' ? 'login.submit_sign_in' : 'login.submit_sign_up')}
      </Button>

      <p className="mt-3 text-xs leading-relaxed text-white/60">{t('login.approval_notice')}</p>
    </form>
  );
}

const loginInputClass = cn(
  'min-h-12 w-full rounded-(--radius-input) border border-white/20 bg-white/10 px-4',
  'text-base text-white placeholder:text-white/40',
  'transition-[border-color,box-shadow,background-color] duration-(--duration-tip) ease-(--ease-out-quiet)',
  'hover:border-white/35',
  'focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none',
  'motion-reduce:transition-none',
);

function LoginField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-white/90">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-white/55">{hint}</p> : null}
    </div>
  );
}
