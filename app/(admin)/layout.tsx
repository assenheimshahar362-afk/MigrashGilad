import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getAdminIdentity } from '@/lib/auth';
import { getSettings } from '@/lib/data';
import { t } from '@/lib/i18n';
import { AdminNav } from '@/components/admin/admin-nav';
import { SiteHeader } from '@/components/chrome/site-header';
import { BottomNav } from '@/components/chrome/bottom-nav';
import { RequestModalProvider } from '@/components/request/request-modal-context';
import { RequestModal } from '@/components/request/request-modal';

/**
 * §2: role is resolved server-side on EVERY request from `admin_allowlist`,
 * never from a JWT claim the client could stale-cache. That is why this lookup
 * lives in the layout rather than being computed once at sign-in — a revoked
 * admin loses access on their next navigation, not when their token expires.
 *
 * The admin area wears the SAME global chrome as the public site — the site
 * header (and, on a phone, the tab bar) rather than a dark bar of its own. It
 * used to have neither, which meant that once you were in /admin the only way
 * back to the site was to sign out: the one door out of the room was also the
 * one that locked it behind you. Now the badge, the primary nav and the account
 * icons are all present here exactly as they are everywhere else, and what is
 * particular to this area — who you are signed in as, and the section tabs —
 * sits in a slim band beneath them instead of replacing them.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getAdminIdentity();

  // Middleware has already bounced the signed-out. Reaching here without an
  // identity means signed in but not on the allowlist.
  if (!identity) redirect('/login?error=1');

  const settings = await getSettings();

  return (
    // The header's "request" nav item opens the booking modal rather than
    // linking anywhere, so it needs the same provider the public layout gives
    // it — otherwise `useRequestModal` throws the moment the header renders.
    <RequestModalProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader pitchName={settings.pitchName} />

        {/* The admin band. Light, on the sunken surface, closed by a single
            hairline: under a frosted white header a dark block would read as a
            second header rather than as this one's continuation. It is
            deliberately NOT sticky — the site header above it is, so the way
            out stays on screen while scrolling without two bars stacking up and
            eating a phone's viewport. */}
        <div className="border-b border-(--hairline) bg-(--surface-sunken)">
          <div className="mx-auto flex max-w-[960px] items-center gap-2 px-4 pt-3 pb-2">
            <ShieldCheck className="size-4 shrink-0 text-primary-600" aria-hidden />
            <span className="font-display text-sm font-bold text-(--ink)">{t('admin.title')}</span>

            {identity.role === 'super_admin' ? (
              <span className="shrink-0 rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">
                {t('managers.role.super_admin')}
              </span>
            ) : null}

            {/* Which account you are acting as. `ms-auto` parks it at the end of
                the line; it is the one thing here that can be long, so it is
                also the one thing allowed to truncate. */}
            <span dir="ltr" className="ms-auto min-w-0 truncate text-xs text-(--ink-faint)">
              {identity.email}
            </span>
          </div>

          <AdminNav role={identity.role} />
        </div>

        <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-4 py-8 pb-24">
          {children}
        </main>

        {/* The phone's main menu. From `lg` it hides itself and the header's own
            nav takes over, so the two are never both on screen. */}
        <BottomNav />
      </div>

      <RequestModal settings={settings} />
    </RequestModalProvider>
  );
}
