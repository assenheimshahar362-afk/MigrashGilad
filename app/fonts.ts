import { Heebo, Rubik } from 'next/font/google';

/**
 * §11.2. Two families, each with one job:
 *   - Rubik: headings. A geometric Hebrew sans with weight and confidence at
 *     large sizes, which is what carries the "premium product" read.
 *   - Heebo: all body text, forms, buttons — and, at `tabular-nums`, the time
 *     column, so the schedule's figures align in RTL. One family for body and
 *     data means the grid's times sit in the same voice as everything around
 *     them instead of looking pasted in.
 *
 * `next/font/google` downloads these at build time and serves them from our own
 * origin with the right `font-display`, so nothing is fetched from Google at
 * runtime and the CSP has no third-party font host. The Hebrew subset only,
 * which is most of the weight saving.
 *
 * To vendor the .woff2 files into the repo instead (fully offline builds), run
 * `node scripts/vendor-fonts.mjs` and swap these calls for `next/font/local` —
 * the CSS variable names below are the only contract the rest of the app
 * depends on.
 */
export const fontDisplay = Rubik({
  subsets: ['hebrew'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-display-loaded',
  fallback: ['system-ui', 'sans-serif'],
});

export const fontSans = Heebo({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans-loaded',
  fallback: ['system-ui', 'sans-serif'],
});

/** The same family as the body text; the tabular figures come from
 *  `font-variant-numeric`, not from a different typeface. */
export const fontData = fontSans;

export const fontVariables = [fontDisplay.variable, fontSans.variable].join(' ');
