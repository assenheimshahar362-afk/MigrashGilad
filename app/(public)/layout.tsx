import { getSettings } from '@/lib/data';
import { SiteHeader } from '@/components/chrome/site-header';
import { BottomNav } from '@/components/chrome/bottom-nav';
import { SiteFooter } from '@/components/chrome/site-footer';
import { InstallPrompt } from '@/components/pwa/install-prompt';

/**
 * §3 global chrome for the public site. The header, tab bar and footer are the
 * same on every public screen; the memorial section of /about carries no booking
 * CTA of its own (§10.6).
 *
 * The header decides for itself whether to start transparent — it already reads
 * the pathname for its active-link state, and a function cannot be handed from
 * a server layout into a client component anyway.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader pitchName={settings.pitchName} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter pitchName={settings.pitchName} />
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
