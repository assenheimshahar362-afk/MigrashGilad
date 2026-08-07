'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

/**
 * The sign-in affordance in the public header.
 *
 * §2 used to forbid this outright — the only route to /login was typing it.
 * That rule is lifted deliberately: people can now ask for access themselves,
 * so there has to be a door. What has NOT changed is what being signed in
 * means: the session is only ever issued to an address on `admin_allowlist`,
 * and everything behind it is still gated server-side on every request.
 *
 * The session is resolved in the browser rather than in the layout on purpose.
 * Reading cookies in the public layout would opt every public page out of
 * static rendering (NFR-3) to change two icons — so the header renders the
 * signed-out state, then settles. The slot is a fixed size, so nothing beside
 * it moves when it does.
 */
export function AuthIcons({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });

    // Signing out in another tab must not leave this one showing an admin link.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setPending(true);
    await createClient().auth.signOut();
    setSignedIn(false);
    setPending(false);
    router.refresh();
  };

  const iconClass = cn(
    'press tap-target flex items-center justify-center rounded-(--radius-input)',
    'transition-[background-color,border-color,color,transform] duration-(--duration-press)',
    'ease-(--ease-out-quiet)',
    onDark
      ? 'border border-white/25 bg-white/12 text-white backdrop-blur-sm hover:bg-white/22'
      : 'border border-(--hairline) bg-(--surface-raised) text-(--ink) hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
  );

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2',
        // Only the swap fades. The icons themselves never move, because the
        // signed-out state already occupies the width the signed-in state needs.
        'transition-opacity duration-(--duration-tip) ease-(--ease-out-quiet)',
        signedIn === null && 'opacity-0',
      )}
    >
      {signedIn ? (
        <>
          <Link href="/admin" className={iconClass} aria-label={t('nav.admin')} title={t('nav.admin')}>
            <ShieldCheck className="size-5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className={cn(iconClass, 'disabled:opacity-50')}
            aria-label={t('admin.sign_out')}
            title={t('admin.sign_out')}
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className={iconClass}
          aria-label={t('login.title')}
          title={t('login.title')}
        >
          <LogIn className="size-5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
