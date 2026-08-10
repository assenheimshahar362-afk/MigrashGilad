'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/** The official four-colour "G" mark. Flat paths, no filters — reads crisply at 20px. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * §15: Supabase Auth, Google provider, `@supabase/ssr` cookie sessions.
 *
 * Shared by /login and /register — the OAuth call is identical either way,
 * only the label differs. `requireConsent` exists for the register page: the
 * §2 approval notice applies to Google sign-up exactly as it does to the
 * password form, so the same checkbox gates both.
 */
export function LoginButton({
  next,
  label,
  pendingLabel,
  requireConsent = false,
  consentAccepted = false,
  onConsentMissing,
}: {
  next: string;
  label?: string;
  pendingLabel?: string;
  requireConsent?: boolean;
  consentAccepted?: boolean;
  onConsentMissing?: () => void;
}) {
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    if (requireConsent && !consentAccepted) {
      onConsentMissing?.();
      return;
    }

    setPending(true);
    const supabase = createClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        // Google otherwise reuses whatever account is already signed into the
        // browser and skips its own account picker — silently landing whoever
        // clicks this on the admin's existing session instead of letting them
        // pick which Google account to continue with.
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) setPending(false);
  };

  return (
    <Button
      variant="secondary"
      size="lg"
      className="mt-8 w-full"
      onClick={signIn}
      disabled={pending}
      loading={pending}
    >
      <GoogleIcon />
      {pending ? (pendingLabel ?? t('login.signing_in')) : (label ?? t('login.google'))}
    </Button>
  );
}
