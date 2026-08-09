import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { fontVariables } from '@/app/fonts';
import { getSettings } from '@/lib/data';
import { isMemorialDay } from '@/lib/schedule';
import { todayLocal } from '@/lib/time';
import { t } from '@/lib/i18n';
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: `${t('app.name')} — ${t('schedule.title')}`,
    template: `%s · ${t('app.name')}`,
  },
  description: 'לוח הזמנים של מגרש גלעד, מגרש הכדורגל הקהילתי. צפייה בשימושי המגרש והגשת בקשה.',
  applicationName: t('app.name'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: t('app.name'),
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: t('app.name'),
    title: t('app.name'),
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
  // FR-40: the memorial-day variant is decided on the server from a date stored
  // per-year in settings, never computed from a Hebrew calendar library (§14).
  const settings = await getSettings();
  const memorialDay = isMemorialDay(settings, todayLocal());

  // The favicon and the apple-touch icon are `app/icon.png` and
  // `app/apple-icon.png`; Next emits both <link> tags from those filenames,
  // with a content hash, so there is nothing to declare here. Both are written
  // by `npm run icons` from the club badge.
  return (
    <html lang="he" dir="rtl" data-memorial-day={memorialDay ? 'true' : 'false'} suppressHydrationWarning>
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
