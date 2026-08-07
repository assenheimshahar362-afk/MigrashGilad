#!/usr/bin/env node
/**
 * §12 requires four PNG icons. Rather than commit placeholder binaries that
 * nobody will remember to replace, this script writes them from an SVG that
 * encodes the design system: the deep evening turf field, a chalk centre circle
 * and the halfway line — the same line-marking language as the schedule grid
 * (§11.3).
 *
 * PNG conversion needs a rasteriser, which is not a dependency worth adding for
 * four files. Next ships sharp, so this uses it when it resolves and otherwise
 * prints the one command that turns the SVGs into PNGs; the SVGs alone are
 * enough for every browser except the manifest, which insists on PNG.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';

const PITCH_900 = '#0E2A20';
const CHALK = '#F2F5F0';
const FLOODLIGHT = '#F2B441';

/** `safe` insets the artwork for the maskable variant's 20% safe zone. */
function icon({ safe = 0, badge = false } = {}) {
  const inset = 512 * safe;
  const size = 512 - inset * 2;
  const stroke = badge ? 18 : 10;
  const lineColor = badge ? CHALK : CHALK;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${PITCH_900}"/>
  <g transform="translate(${inset} ${inset})" opacity="${badge ? 1 : 0.9}">
    <rect x="${size * 0.08}" y="${size * 0.14}" width="${size * 0.84}" height="${size * 0.72}"
          fill="none" stroke="${lineColor}" stroke-width="${stroke}"/>
    <line x1="${size * 0.5}" y1="${size * 0.14}" x2="${size * 0.5}" y2="${size * 0.86}"
          stroke="${lineColor}" stroke-width="${stroke}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.15}"
            fill="none" stroke="${lineColor}" stroke-width="${stroke}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${stroke * 0.9}" fill="${FLOODLIGHT}"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });

const files = {
  'public/icons/icon.svg': icon(),
  // Maskable icons are cropped to a circle on some launchers; the 20% inset
  // keeps the pitch rectangle inside the safe zone.
  'public/icons/maskable.svg': icon({ safe: 0.1 }),
  'public/icons/badge.svg': icon({ badge: true }),
};

for (const [path, content] of Object.entries(files)) {
  await writeFile(path, content, 'utf8');
  console.log(`wrote ${path}`);
}

/** [source svg, output png, edge length] — the set §12 and the manifest expect. */
const rasters = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/maskable-512.png', 512],
  ['public/icons/icon.svg', 'public/icons/apple-touch-icon.png', 180],
  ['public/icons/badge.svg', 'public/icons/badge-72.png', 72],
];

// sharp arrives transitively with Next rather than as a declared dependency, so
// its absence is a fallback, not a failure.
const sharp = await import('sharp').then((m) => m.default).catch(() => null);

if (!sharp) {
  console.log(`
sharp did not resolve. Rasterise them by hand (any tool works):
${rasters.map(([from, to, px]) => `  npx --yes sharp-cli -i ${from} -o ${to} resize ${px} ${px}`).join('\n')}
`);
} else {
  for (const [from, to, px] of rasters) {
    await sharp(from, { density: 384 }).resize(px, px).png().toFile(to);
    console.log(`wrote ${to}`);
  }
}
