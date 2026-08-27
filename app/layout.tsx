import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { fontVariables } from '@/app/fonts';
import { t } from '@/lib/i18n';
import { siteUrl } from '@/lib/utils';
import { SkipLink } from '@/components/chrome/skip-link';
import { ServiceWorkerBridge } from '@/components/pwa/service-worker-bridge';
import { AccessibilityMenu } from '@/components/a11y/accessibility-menu';
import './globals.css';

/**
 * Applies a saved accessibility preference (font scale, contrast, underlined
 * links, reduced motion — see `components/a11y/accessibility-menu.tsx`) to
 * `<html>` before the page paints, so a returning visitor who set one never
 * sees a flash of the unadjusted page. `beforeInteractive` is what makes Next
 * inline this ahead of hydration; `<html suppressHydrationWarning>` below is
 * needed because this intentionally sets attributes React did not render.
 */
const A11Y_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('mg.a11y-prefs');
    if (!raw) return;
    var prefs = JSON.parse(raw);
    var root = document.documentElement;
    root.dataset.a11yFontScale = prefs.fontScale || 'md';
    root.dataset.a11yContrast = String(!!prefs.contrast);
    root.dataset.a11yUnderlineLinks = String(!!prefs.underlineLinks);
    root.dataset.a11yMotion = prefs.reduceMotion ? 'reduce' : 'no-preference';
  } catch (e) {}
})();
`;

const SITE_TITLE = `${t('app.name')} - ${t('schedule.title')}`;
const SITE_DESCRIPTION =
  'לוח הזמנים של מגרש גילעד. צפייה בשימושי המגרש והגשת בקשה.';

// The card WhatsApp, iMessage, Slack etc. show for a shared link — a share
// with no image or description reads as a bare, half-broken URL rather than
// a real site. Built once as a real branded frame (the pitch photo + the
// club crest + the wordmark, matching the Hero's own RTL layout) rather than
// left to whatever a crawler happens to screenshot; see
// `scripts/gen-og-image.mjs` for how it was generated.
const OG_IMAGE = {
  url: '/images/og-cover.jpg',
  width: 1200,
  height: 630,
  alt: `${t('app.name')} - ${t('app.tagline')}`,
};

export const metadata: Metadata = {
  // Resolves `/images/og-cover.jpg` below into the absolute URL a crawler can
  // actually fetch. See `siteUrl()` for why this is not read straight off
  // `NEXT_PUBLIC_SITE_URL`.
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s · ${t('app.name')}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: t('pwa.name'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: t('pwa.name'),
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: t('app.name'),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#071120',
  width: 'device-width',
  initialScale: 1,
  // §12 iOS: the bottom tab bar sits in the safe area, so the viewport has to
  // extend under it.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The favicon and the apple-touch icon are `app/icon.png` and
  // `app/apple-icon.png`; Next emits both <link> tags from those filenames,
  // with a content hash, so there is nothing to declare here. Both are written
  // by `npm run icons` from the club badge.
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={fontVariables}>
        <Script id="a11y-init" strategy="beforeInteractive">
          {A11Y_INIT_SCRIPT}
        </Script>
        <SkipLink />
        {children}
        <AccessibilityMenu />
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
