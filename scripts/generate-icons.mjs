#!/usr/bin/env node
/**
 * §12 requires four PNG icons, plus a notification badge. They are all derived
 * here from ONE source of truth — `public/images/logo.png`, the club badge —
 * so that replacing the logo and re-running this script is the whole job.
 *
 *   node scripts/generate-icons.mjs
 *
 * The badge in the artwork is a disc with the wordmark set beside it, and the
 * two overlap. The disc is therefore cut out by geometry (centre and radius
 * below), not by trimming to the artwork's bounding box, which would drag the
 * wordmark in with it.
 *
 * Everything is rendered onto the cream of the badge's own interior rather than
 * onto transparency: a PWA icon is composited over whatever the launcher's
 * background happens to be, and a transparent one goes invisible on half of
 * them.
 */
import { mkdir } from 'node:fs/promises';

const SOURCE = 'public/images/logo.png';

/** The disc inside the artwork, measured once from the source file. */
const DISC = { cx: 462, cy: 370, r: 313 };

/** The badge's own paper colour, so the icon has no seam around the disc. */
const CREAM = '#F5F1E7';
/** The navy of the ring, used for the monochrome notification badge. */
const NAVY = '#1E3A5F';

// sharp arrives transitively with Next rather than as a declared dependency, so
// its absence is a fallback, not a failure.
const sharp = await import('sharp').then((m) => m.default).catch(() => null);

if (!sharp) {
  console.error(
    'sharp did not resolve, and every icon here is a raster derived from a PNG.\n' +
      'Run `npm install sharp` (or `npm ci`) and try again.',
  );
  process.exit(1);
}

await mkdir('public/icons', { recursive: true });

/** The disc, cut to a circle, on a transparent square. */
async function disc() {
  const size = DISC.r * 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${DISC.r}" cy="${DISC.r}" r="${DISC.r}" fill="#fff"/></svg>`,
  );

  return sharp(SOURCE)
    .extract({ left: DISC.cx - DISC.r, top: DISC.cy - DISC.r, width: size, height: size })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * `safe` is the fraction of the edge left empty. Android crops a maskable icon
 * to whatever shape the launcher likes, and only the middle 80% is guaranteed
 * to survive; a plain icon needs far less, but not zero, or the disc kisses the
 * corners of the square.
 */
async function iconPng(source, px, { safe = 0.06, background = CREAM } = {}) {
  const inner = Math.round(px * (1 - safe * 2));

  return sharp({
    create: {
      width: px,
      height: px,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: await sharp(source).resize(inner, inner, { fit: 'contain', background: CREAM }).toBuffer(),
        gravity: 'centre',
      },
    ])
    .png()
    .toBuffer();
}

const mark = await disc();

/**
 * The notification badge is drawn by the platform in a single colour and is
 * usually 24px on screen, so it gets the silhouette of the disc rather than the
 * artwork inside it — anything more becomes a grey smudge.
 */
const badge = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
  <circle cx="36" cy="36" r="30" fill="none" stroke="${NAVY}" stroke-width="7"/>
  <circle cx="36" cy="36" r="9" fill="${NAVY}"/>
</svg>`,
);

const outputs = [
  ['public/icons/icon-192.png', await iconPng(mark, 192)],
  ['public/icons/icon-512.png', await iconPng(mark, 512)],
  // 10% per edge = the 80% safe zone the maskable spec asks for.
  ['public/icons/maskable-512.png', await iconPng(mark, 512, { safe: 0.12 })],
  ['public/icons/apple-touch-icon.png', await iconPng(mark, 180)],
  ['public/icons/badge-72.png', await sharp(badge, { density: 384 }).resize(72, 72).png().toBuffer()],
  // The favicon Next serves from /app. 48px covers every browser tab size.
  ['public/icons/favicon.png', await iconPng(mark, 48, { safe: 0.04 })],
  // The header wears the disc itself, over the page rather than over a launcher
  // background, so this one keeps its transparency.
  ['public/images/logo-mark.png', mark],
];

const { writeFile } = await import('node:fs/promises');

for (const [path, buffer] of outputs) {
  await writeFile(path, buffer);
  console.log(`wrote ${path} (${(buffer.length / 1024).toFixed(0)}KB)`);
}
