import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

/**
 * §7 Security headers. CSP is intentionally strict; the only third party the
 * browser is allowed to talk to is Supabase (data + realtime websocket) and
 * Cloudflare Turnstile (bot protection on the single public write surface).
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').origin;
  } catch {
    return 'https://placeholder.supabase.co';
  }
})();

const supabaseWs = supabaseOrigin.replace(/^https:/, 'wss:');

const isDev = process.env.NODE_ENV === 'development';

// `next dev` compiles modules through React Refresh, which evaluates strings as
// JavaScript, and drives hot reload over a plain-ws socket. Neither is allowed
// by the production policy, so both are widened for development only.
const devScriptSrc = isDev ? ` 'unsafe-eval'` : '';
const devConnectSrc = isDev ? ` ws://localhost:* http://localhost:*` : '';

const csp = [
  `default-src 'self'`,
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required for
  // the App Router runtime unless a nonce is threaded through every response.
  `script-src 'self' 'unsafe-inline'${devScriptSrc} https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${devConnectSrc}`,
  `frame-src https://challenges.cloudflare.com https://www.google.com`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  // @serwist/next only hooks the webpack compiler (no Turbopack support yet:
  // https://github.com/serwist/serwist/issues/54). It's a no-op in dev
  // (disabled above), so Turbopack dev is fine; `next build` is forced onto
  // webpack via the `build` script so the service worker still gets built.
  // This empty object just tells Next "Turbopack is intentional" and
  // silences its webpack-config-with-no-turbopack-config safety check.
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // The site used to be six routes, then briefly merged into anchor
  // sections on the home page (§ merge). /rules and /accessibility have
  // since moved back to being real routes (app/(public)/rules,
  // app/(public)/accessibility) and need no redirect any more — Next serves
  // them directly. /about, /trustees, /contact are still anchors; these
  // redirects keep old bookmarks and any indexed links working rather than
  // 404ing.
  async redirects() {
    return [
      // The booking form is a floating modal now (no #request section to
      // land on), so an old bookmark goes to the home page plain.
      { source: '/request', destination: '/', permanent: true },
      // The per-request status page is gone: a requester no longer tracks
      // their own booking, a trustee calls or WhatsApps them back instead
      // (§ request flow revision). An old `/request/<token>` link — saved
      // from a success screen, or sent to someone's own WhatsApp — now goes
      // home rather than 404ing.
      { source: '/request/:token', destination: '/', permanent: true },
      { source: '/about', destination: '/#about', permanent: true },
      { source: '/trustees', destination: '/#trustees', permanent: true },
      { source: '/contact', destination: '/#contact', permanent: true },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // The service worker fights hot reload; it is a production-only concern.
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
