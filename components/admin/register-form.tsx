'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, MailCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { apiFetch, errorText } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { LoginButton } from '@/components/admin/login-button';

/**
 * §15 email + password sign-up, split out of the old tabbed `LoginForm` onto
 * its own page. The checkbox is the §2 approval notice made into something
 * that has to be actively agreed to rather than read past — it stands in for
 * the plain-text notice this form used to carry, and it gates the Google
 * button too, since a Google sign-up grants exactly as little as this one
 * does.
 */
export function RegisterForm({ next }: { next: string }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showAckError, setShowAckError] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!acknowledged) {
      setShowAckError(true);
      return;
    }

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      await apiFetch('/api/auth/sign-up', {
        method: 'POST',
        json: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          fullName: String(form.get('fullName') ?? ''),
        },
      });
      setSent(true);
    } catch (thrown) {
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-rise-in mt-6 rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) p-5 text-start">
        <p className="flex items-center gap-2 font-semibold text-(--ink)">
          <MailCheck className="size-5 shrink-0 text-primary-600" aria-hidden />
          {t('register.check_email')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-(--ink-muted)">
          {t('register.check_email_body')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 text-start" noValidate>
      <div className="space-y-3">
        <RegisterField id={`${id}-name`} label={t('register.full_name')}>
          <Input id={`${id}-name`} name="fullName" type="text" required autoComplete="name" minLength={2} maxLength={80} />
        </RegisterField>

        <RegisterField id={`${id}-email`} label={t('login.email')}>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            className="text-start"
          />
        </RegisterField>

        <RegisterField id={`${id}-password`} label={t('login.password')} hint={t('register.password_hint')}>
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            required
            dir="ltr"
            minLength={8}
            autoComplete="new-password"
            className="text-start"
          />
        </RegisterField>
      </div>

      <label className="mt-4 flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => {
            setAcknowledged(event.target.checked);
            if (event.target.checked) setShowAckError(false);
          }}
          aria-invalid={showAckError || undefined}
          aria-describedby={showAckError ? `${id}-ack-error` : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
        />
        <span className="text-sm leading-relaxed text-(--ink-muted)">
          {t('register.approval_checkbox')}
        </span>
      </label>
      {showAckError ? (
        <p
          id={`${id}-ack-error`}
          role="alert"
          className="animate-rise-in mt-2 flex items-start gap-1.5 text-sm font-semibold text-danger-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('register.checkbox_error')}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="animate-rise-in mt-4 flex items-start gap-2 rounded-(--radius-input) border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className={cn('mt-5 w-full')} loading={pending}>
        {t('register.submit')}
      </Button>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold text-(--ink-faint)">
        <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
        {t('login.or')}
        <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
      </div>

      <LoginButton
        next={next}
        label={t('register.google')}
        pendingLabel={t('register.signing_up')}
        requireConsent
        consentAccepted={acknowledged}
        onConsentMissing={() => setShowAckError(true)}
      />

      <p className="mt-4 text-center text-sm text-(--ink-muted)">
        {t('register.have_account')}{' '}
        <Link href="/login" className="font-semibold text-primary-700 hover:underline">
          {t('register.login_cta')}
        </Link>
      </p>
    </form>
  );
}

function RegisterField({
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
      <label htmlFor={id} className="text-sm font-semibold text-(--ink)">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-(--ink-faint)">{hint}</p> : null}
    </div>
  );
}
