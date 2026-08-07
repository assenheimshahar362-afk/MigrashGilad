import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * §11.4: phone numbers, times and dates are LTR runs inside RTL text. Rendering
 * them raw makes `+972` come out as `972+`. Prefer the <Ltr> component; this is
 * for the places where a plain string is required (aria-label, title, ics).
 */
export function ltrIsolate(value: string): string {
  return `⁦${value}⁩`;
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

export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return new URL(path, base).toString();
}
