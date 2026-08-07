import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminIdentity } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { AdminNav } from '@/components/admin/admin-nav';
import { SignOutButton } from '@/components/admin/sign-out-button';

/**
 * §2: role is resolved server-side on EVERY request from `admin_allowlist`,
 * never from a JWT claim the client could stale-cache. That is why this lookup
 * lives in the layout rather than being computed once at sign-in — a revoked
 * admin loses access on their next navigation, not when their token expires.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getAdminIdentity();

  // Middleware has already bounced the signed-out. Reaching here without an
  // identity means signed in but not on the allowlist.
  if (!identity) redirect('/login?error=1');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-primary-800 text-white">
        <div className="mx-auto flex max-w-[960px] items-center gap-3 px-4 py-3.5">
          <Link href="/admin" className="min-w-0 flex-1">
            <span className="block truncate font-display text-h3 font-bold">
              {t('admin.title')}
            </span>
            <span className="block truncate text-xs text-primary-100">{identity.email}</span>
          </Link>

          {identity.role === 'super_admin' ? (
            <span className="shrink-0 rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">
              {t('managers.role.super_admin')}
            </span>
          ) : null}

          <SignOutButton />
        </div>

        <AdminNav role={identity.role} />
      </header>

      <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-4 py-8 pb-24">
        {children}
      </main>
    </div>
  );
}
