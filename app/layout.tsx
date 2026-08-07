import type { Metadata, Viewport } from 'next';
import { fontVariables } from '@/app/fonts';
import { getSettings } from '@/lib/data';
import { isMemorialDay } from '@/lib/schedule';
import { todayLocal } from '@/lib/time';
import { t } from '@/lib/i18n';
import { SkipLink } from '@/components/chrome/skip-link';
import { ServiceWorkerBridge } from '@/components/pwa/service-worker-bridge';
import './globals.css';

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
  themeColor: '#0E2A20',
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

  return (
    <html lang="he" dir="rtl" data-memorial-day={memorialDay ? 'true' : 'false'}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={fontVariables}>
        <SkipLink />
        {children}
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
