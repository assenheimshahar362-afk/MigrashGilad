'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={t('admin.sign_out')}
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/');
        router.refresh();
      }}
      className="tap-target flex shrink-0 items-center justify-center rounded-[--radius-input] text-chalk-200 hover:bg-chalk-050/10"
    >
      <LogOut className="size-5" aria-hidden />
    </button>
  );
}
