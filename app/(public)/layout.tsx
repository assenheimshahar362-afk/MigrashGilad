import { Suspense } from 'react';
import { getSettings } from '@/lib/data';
import { SiteHeader } from '@/components/chrome/site-header';
import { BottomNav } from '@/components/chrome/bottom-nav';
import { SiteFooter } from '@/components/chrome/site-footer';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { InstallProvider } from '@/components/pwa/install-context';
import { RequestModalProvider } from '@/components/request/request-modal-context';
import { RequestModal } from '@/components/request/request-modal';
import { RequestModalUrlOpener } from '@/components/request/request-modal-url-opener';
import { EventDetailProvider } from '@/components/schedule/event-detail-context';
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
        {/* §12 install state, shared by the one-time banner and the footer's
            own install button — `beforeinstallprompt` fires once per load and
            only a listener that is already attached can catch it. */}
        <InstallProvider>
          {/* FR-4: the calendar's event-detail sheet. Mounted beside the
              booking modal rather than inside the schedule page, so the week
              grid and the day view — and anything else that ever draws an
              event — all open the same single sheet. */}
          <EventDetailProvider>
            <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
              <SiteHeader pitchName={settings.pitchName} />

              {/* `tabIndex={-1}`: without it, activating the skip link only
                  moves the browser's sequential-focus starting point —
                  `document.activeElement` stays on <body>, so a screen reader
                  announces nothing and Safari drops the jump altogether. With
                  it, focus actually lands here and the next Tab continues from
                  the content (WCAG 2.4.1). It never enters the tab order — -1
                  is reachable by script and by fragment, not by Tab. */}
              <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
                {children}
              </main>

              <SiteFooter pitchName={settings.pitchName} />
              <BottomNav />
              <InstallPrompt />
            </div>
          </EventDetailProvider>
        </InstallProvider>

        <RequestModal settings={settings} />
        <Suspense fallback={null}>
          <RequestModalUrlOpener />
        </Suspense>
      </RequestModalProvider>
    </TooltipProvider>
  );
}
