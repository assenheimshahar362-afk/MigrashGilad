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
  `frame-src https://challenges.cloudflare.com`,
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
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
