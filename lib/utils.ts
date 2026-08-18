import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * `+972541234567` -> `054-1234567`, which is how Israelis read a number.
 * An Israeli mobile is +972 followed by nine digits: a two-digit prefix (5X)
 * and a seven-digit subscriber number.
 */
export function formatIsraeliPhone(e164: string): string {
  const match = e164.match(/^\+972(\d{2})(\d{7})$/);
  if (!match) return e164;
  const [, prefix, subscriber] = match;
  return `0${prefix}-${subscriber}`;
}

/** FR-28: `wa.me` wants the number with no plus and no separators. */
export function whatsappNumber(e164: string): string {
  return e164.replace(/\D/g, '');
}

export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${whatsappNumber(e164)}?text=${encodeURIComponent(message)}`;
}

export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** Initials for the avatar fallback on a trustee card (§10.5). */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
}

/** Where this site actually lives in production. The last-resort fallback
 *  below, so a deployment that never sets `NEXT_PUBLIC_SITE_URL` still shares
 *  a working link rather than pointing the whole internet at `localhost`. */
const PRODUCTION_SITE_URL = 'https://migrash-gilad.vercel.app';
const DEV_SITE_URL = 'http://localhost:3000';

function isLoopback(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(url);
}

/**
 * The origin this deployment is reachable at — the base for `metadataBase`
 * (the og:image / twitter:image cards), the Supabase e-mail confirmation
 * redirect, and every link in an outgoing notification e-mail. Getting it
 * wrong is not cosmetic: a `localhost` og:image is an image nobody but the
 * developer can load, and a `localhost` confirmation link cannot be clicked
 * at all.
 *
 * `NEXT_PUBLIC_SITE_URL` still wins, so a custom domain needs no code change
 * — with one exception: a loopback value is IGNORED once actually deployed.
 * `.env.example` ships `http://localhost:3000` for local work and that line
 * is easy to copy into a hosting dashboard verbatim, which would silently
 * put "localhost" back into every share card and every emailed link.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` (the project's stable production domain)
 * is preferred over `VERCEL_URL` (this one deployment's generated host):
 * a share card and a confirmation link should both point at the real site,
 * not at a preview build that will be superseded. Neither is `NEXT_PUBLIC_`,
 * so both resolve on the server only — which is where every caller runs.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  const deployed = Boolean(process.env.VERCEL);
  if (explicit && !(deployed && isLoopback(explicit))) return explicit;

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return `https://${host}`;

  return process.env.NODE_ENV === 'development' ? DEV_SITE_URL : PRODUCTION_SITE_URL;
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}
