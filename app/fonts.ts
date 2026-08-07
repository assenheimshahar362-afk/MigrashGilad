import { Assistant, Frank_Ruhl_Libre, Heebo } from 'next/font/google';

/**
 * §11.2. Three families, each with one job:
 *   - Frank Ruhl Libre: a Hebrew serif with civic gravitas. Page titles, the
 *     pitch name, the memorial page. Used sparingly.
 *   - Assistant: all interface text, forms, buttons.
 *   - Heebo: tabular figures for times and counts, so the time column aligns
 *     in RTL — the one place where the wrong figures make the grid unreadable.
 *
 * `next/font/google` downloads these at build time and serves them from our own
 * origin with the right `font-display`, so nothing is fetched from Google at
 * runtime and the CSP has no third-party font host. The Hebrew subset only,
 * which is most of the weight saving.
 *
 * To vendor the .woff2 files into the repo instead (fully offline builds), run
 * `node scripts/vendor-fonts.mjs` and swap these three calls for
 * `next/font/local` — the CSS variable names below are the only contract the
 * rest of the app depends on.
 */
export const fontDisplay = Frank_Ruhl_Libre({
  subsets: ['hebrew'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-display-loaded',
  fallback: ['Times New Roman', 'serif'],
});

export const fontSans = Assistant({
  subsets: ['hebrew'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-sans-loaded',
  fallback: ['system-ui', 'sans-serif'],
});

export const fontData = Heebo({
  subsets: ['hebrew'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-data-loaded',
  fallback: ['system-ui', 'sans-serif'],
});

export const fontVariables = [fontDisplay.variable, fontSans.variable, fontData.variable].join(' ');
