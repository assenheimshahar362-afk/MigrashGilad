import { getOnDutyTrustee, getSettings } from '@/lib/data';
import { SiteHeader } from '@/components/chrome/site-header';
import { BottomNav } from '@/components/chrome/bottom-nav';
import { SiteFooter } from '@/components/chrome/site-footer';
import { InstallPrompt } from '@/components/pwa/install-prompt';

/**
 * §3 global chrome for the public site. The header, tab bar and footer are the
 * same on every public screen; only /memorial suppresses the booking CTA, which
 * it does by not rendering one (§10.6).
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, onDuty] = await Promise.all([getSettings(), getOnDutyTrustee()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader pitchName={settings.pitchName} onDuty={onDuty} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter />
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
