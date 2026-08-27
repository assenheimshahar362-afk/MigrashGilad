#!/usr/bin/env node
/**
 * The link-preview card WhatsApp, iMessage, Slack and every other social
 * crawler show when this site's URL is shared. Without an `og:image` a
 * shared link renders as a bare, half-broken line of text — this is what
 * makes it look like a real product instead.
 *
 * Rendered with a real browser (Playwright/Chromium) rather than
 * `next/og`'s `ImageResponse` (Satori) specifically for the Hebrew text:
 * Satori's bidi/RTL shaping is unreliable, where a real browser gets it
 * right for free, including the exact same RTL layout rules the site's own
 * Hero component relies on (§ note below on `flex-end`).
 *
 *   node scripts/gen-og-image.mjs
 *
 * Source images: public/images/pitch-aerial.webp (the Hero's own background)
 * and public/images/logo.png (the club crest). Output: 1200×630 JPEG, the
 * standard Open Graph card size, written to public/images/og-cover.jpg and
 * wired into the metadata in app/layout.tsx.
 */
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'public/images/og-cover.jpg');
const messages = JSON.parse(await readFile(path.join(ROOT, 'messages/he.json'), 'utf8'));

const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const fileUrl = (relPath) =>
  'file:///' + path.join(ROOT, relPath).replace(/\\/g, '/');

const HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: 'Heebo', sans-serif;
  }
  .card { position: relative; width: 1200px; height: 630px; background: #071120; }
  .bg {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; object-position: center 62%;
  }
  /* Vertical scrim: legibility for the bottom-anchored text. */
  .scrim-v {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom,
      rgba(7,17,32,0.10) 0%, rgba(7,17,32,0.35) 45%, rgba(7,17,32,0.82) 100%);
  }
  /* Horizontal scrim: darkens the RIGHT side, where the content sits. Coded
     in physical terms ("to left" starts at the right edge) on purpose — see
     the alignment note on .content below. */
  .scrim-h {
    position: absolute; inset: 0;
    background: linear-gradient(to left,
      rgba(7,17,32,0.90) 0%, rgba(7,17,32,0.55) 38%, rgba(7,17,32,0.05) 68%, transparent 85%);
  }
  .content {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    /* flex-start, not flex-end: a column flex container's cross-axis
       "start" tracks CSS direction (rtl here), which puts it on the RIGHT —
       the same "content sits at the inline start" rule the real Hero
       component uses. flex-end would put it on the physical left instead,
       fighting the scrim above, which is already coded for the right. */
    align-items: flex-start;
    justify-content: center;
    padding: 0 76px;
    text-align: right;
  }
  .badge {
    width: 168px; height: 168px; border-radius: 999px;
    box-shadow: 0 18px 44px -12px rgba(0,0,0,0.55), 0 0 0 4px rgba(255,255,255,0.08);
    margin-bottom: 34px;
  }
  .title {
    font-family: 'Heebo', sans-serif; font-weight: 700; font-size: 92px; line-height: 1.05;
    color: #ffffff; letter-spacing: -0.02em; text-shadow: 0 4px 24px rgba(0,0,0,0.35);
  }
  /* The rule carries the gap the tagline used to sit in. Without it the
     title and the rule would close to 30px and read as crowded, where the
     card previously had ~88px of air between the name and the meta line. */
  .rule { margin-top: 42px; display: flex; align-items: center; gap: 14px; }
  .dot { width: 10px; height: 10px; border-radius: 999px; background: #d63b2b; }
  .meta { font-family: 'Heebo', sans-serif; font-weight: 500; font-size: 27px; color: rgba(255,255,255,0.72); }
</style>
</head>
<body>
  <div class="card">
    <img class="bg" src="${fileUrl('public/images/pitch-aerial.webp')}" />
    <div class="scrim-v"></div>
    <div class="scrim-h"></div>
    <div class="content">
      <img class="badge" src="${fileUrl('public/images/logo.png')}" />
      <div class="title">${escapeHtml(messages['hero.title'])}</div>
      <div class="rule">
        <span class="dot"></span>
        <span class="meta">לוח זמנים · הגשת בקשה למגרש</span>
      </div>
    </div>
  </div>
</body>
</html>`;

// `page.setContent()` loads into an `about:blank` origin, where Chromium
// refuses `file://` image sources for the same reason it refuses them from
// any http(s) origin — no local-disk access from a page with no disk
// origin of its own. Writing the HTML to an actual file and navigating
// there gives the page a real `file://` origin, so its sibling `file://`
// image references (the pitch photo, the crest) resolve normally.
const tmpHtml = path.join(os.tmpdir(), `og-image-${Date.now()}.html`);
await writeFile(tmpHtml, HTML);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
const page = await context.newPage();
try {
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const heroFontLoaded = await page.evaluate(() => document.fonts.check('700 92px Heebo'));
  if (!heroFontLoaded) throw new Error('Heebo 700 failed to load for the OG image');
  await page.waitForTimeout(300);

  const buffer = await page.screenshot({
    type: 'jpeg',
    quality: 92,
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await writeFile(OUT, buffer);

  console.log(`wrote ${path.relative(ROOT, OUT)} (${(buffer.length / 1024).toFixed(0)}KB)`);
} finally {
  await browser.close();
  await rm(tmpHtml, { force: true });
}
