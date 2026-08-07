'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/** §15: Supabase Auth, Google provider, `@supabase/ssr` cookie sessions. */
export function LoginButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    const supabase = createClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });

    if (error) setPending(false);
  };

  return (
    <Button size="lg" className="mt-8 w-full" onClick={signIn} disabled={pending}>
      {pending ? t('login.signing_in') : t('login.google')}
    </Button>
  );
}
