import { Suspense } from 'react';
import { getSettings } from '@/lib/data';
import { SiteHeader } from '@/components/chrome/site-header';
import { BottomNav } from '@/components/chrome/bottom-nav';
import { SiteFooter } from '@/components/chrome/site-footer';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { RequestModalProvider } from '@/components/request/request-modal-context';
import { RequestModal } from '@/components/request/request-modal';
import { RequestModalUrlOpener } from '@/components/request/request-modal-url-opener';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * §3 global chrome for the public site. The header, tab bar and footer are the
 * same on every public screen; the memorial section of /about carries no booking
 * CTA of its own (§10.6).
 *
 * The header decides for itself whether to start transparent — it already reads
 * the pathname for its active-link state, and a function cannot be handed from
 * a server layout into a client component anyway.
 *
 * The booking form (§10.3) is a floating modal rather than a page section, so
 * its provider wraps everything here — the header, footer and tab bar all
 * open it — and `<RequestModal>` itself is mounted once, alongside them,
 * rather than inside any one page.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    // TooltipProvider wraps the whole public tree, not just whichever screen
    // opens a `<Sheet>` first — `<Sheet>`'s own close button carries one now
    // (§ admin tooltip pass), and it is shared with the public booking modal
    // and the trustee contact sheet, so this has to be here even though
    // nothing on the public site opens a `<Tooltip>` directly.
    <TooltipProvider delayDuration={300}>
      <RequestModalProvider>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader pitchName={settings.pitchName} />

          <main id="main" className="flex-1">
            {children}
          </main>

          <SiteFooter pitchName={settings.pitchName} />
          <BottomNav />
          <InstallPrompt />
        </div>

        <RequestModal settings={settings} />
        <Suspense fallback={null}>
          <RequestModalUrlOpener />
        </Suspense>
      </RequestModalProvider>
    </TooltipProvider>
  );
}
