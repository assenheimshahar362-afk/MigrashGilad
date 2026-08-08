import { chromium } from '@playwright/test';

/**
 * Responsive audit.
 *
 * Loads every public route at 17 real device profiles — from a folded Galaxy
 * (280px) up to a 1920px desktop, including landscape phones and tablets — and
 * fails on anything that breaks the layout contract:
 *
 *   H-SCROLL     the page scrolls sideways (never acceptable)
 *   OVERFLOW     an element sticks out past the viewport edge
 *   TARGET-WCAG  an interactive target under 24x24 (WCAG 2.2 SC 2.5.8, AA)
 *   TARGET-SOFT  a target between 24px and this product's own 44px preference
 *   CLIPPED      text cut off by a fixed-height box
 *
 * Usage: start the app, then `npm run check:responsive`.
 * Exits non-zero if anything but TARGET-SOFT is found.
 */
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.argv[2];

/** Real device metrics, smallest first. Covers the phones and tablets in use. */
const DEVICES = [
  // --- phones, portrait -------------------------------------------------
  { name: 'galaxy-fold-closed', w: 280, h: 653, dpr: 3, touch: true },
  { name: 'iphone-se', w: 375, h: 667, dpr: 2, touch: true },
  { name: 'galaxy-s8', w: 360, h: 740, dpr: 3, touch: true },
  { name: 'iphone-13-mini', w: 375, h: 812, dpr: 3, touch: true },
  { name: 'iphone-14', w: 390, h: 844, dpr: 3, touch: true },
  { name: 'pixel-7', w: 412, h: 915, dpr: 2.6, touch: true },
  { name: 'iphone-14-promax', w: 430, h: 932, dpr: 3, touch: true },
  // --- phones, landscape ------------------------------------------------
  { name: 'iphone-14-landscape', w: 844, h: 390, dpr: 3, touch: true },
  // --- tablets ----------------------------------------------------------
  { name: 'ipad-mini', w: 768, h: 1024, dpr: 2, touch: true },
  { name: 'ipad-air', w: 820, h: 1180, dpr: 2, touch: true },
  { name: 'galaxy-tab', w: 800, h: 1280, dpr: 2, touch: true },
  { name: 'ipad-pro-11', w: 834, h: 1194, dpr: 2, touch: true },
  { name: 'ipad-pro-12', w: 1024, h: 1366, dpr: 2, touch: true },
  { name: 'ipad-pro-land', w: 1366, h: 1024, dpr: 2, touch: true },
  // --- desktop ----------------------------------------------------------
  { name: 'laptop', w: 1280, h: 800, dpr: 1, touch: false },
  { name: 'desktop', w: 1440, h: 900, dpr: 1, touch: false },
  { name: 'wide', w: 1920, h: 1080, dpr: 1, touch: false },
];

// /request, /about, /contact, /trustees, /rules and /accessibility are now
// anchor sections on '/' (redirected there), not separate documents — auditing
// them again would just re-measure the same page.
const PAGES = ['/', '/schedule/month', '/login'];

const browser = await chromium.launch();
const problems = [];

for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dpr,
    isMobile: d.touch,
    hasTouch: d.touch,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    userAgent: d.touch
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });

    // Measuring an unstyled page produces confident nonsense: every flex row
    // becomes a stack, every utility class is inert, and the whole run reports
    // overflow that does not exist. Refuse to measure until the stylesheet has
    // actually applied.
    await page.waitForFunction(
      () =>
        document.styleSheets.length > 0 &&
        getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
      undefined,
      { timeout: 15000 },
    );
    await page.waitForTimeout(350);

    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = { vw, hScroll: 0, overflow: [], smallTargets: [], clipped: [] };

      // 1. The page itself must never scroll sideways.
      out.hScroll = Math.max(
        document.documentElement.scrollWidth - vw,
        document.body.scrollWidth - vw,
      );

      // 2. Any element sticking out past the viewport edge (either side).
      //    Elements inside a deliberate overflow-x container are exempt.
      const isSrOnly = (el) => el.closest('.sr-only') !== null;

      const inScroller = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'auto' || ov === 'scroll') return true;
        }
        return false;
      };

      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const over = Math.max(0 - r.left, r.right - vw);
        if (over > 2 && !inScroller(el)) {
          out.overflow.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 80)) || '',
            over: Math.round(over),
          });
        }
      }

      // 3. Touch targets. A11Y-1 asks for 44x44 on interactive elements.
      for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"]')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        if (isSrOnly(el) || el.classList.contains('sr-only')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Inline links inside a paragraph are exempt — WCAG target-size (AA)
        // excludes targets in a sentence of text.
        const inline = cs.display === 'inline' && el.closest('p, li, dd, td');
        if (inline) continue;
        if (r.height < 44 || r.width < 24) {
          out.smallTargets.push({
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }

      // 4. Text clipped by a fixed-height box.
      for (const el of document.querySelectorAll('h1, h2, h3, p, span, a, button, td, th, li, summary')) {
        if (el.children.length) continue;
        const cs = getComputedStyle(el);
        if (cs.overflow === 'visible' || cs.textOverflow === 'ellipsis' || cs.display === 'none') continue;
        if (isSrOnly(el) || el.classList.contains('sr-only')) continue;
        if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
          out.clipped.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 34),
            by: el.scrollHeight - el.clientHeight,
          });
        }
      }
      return out;
    });

    const dedupe = (arr, key) => [...new Map(arr.map((x) => [key(x), x])).values()];

    if (report.hScroll > 1) problems.push(`[H-SCROLL ${report.hScroll}px] ${d.name} ${path}`);
    for (const o of dedupe(report.overflow, (x) => x.tag + x.cls).slice(0, 4))
      problems.push(`[OVERFLOW ${o.over}px] ${d.name} ${path} <${o.tag}> ${o.cls}`);
    for (const s of dedupe(report.smallTargets, (x) => x.tag + x.label).slice(0, 4))
      problems.push(
        `[TARGET-${s.h < 24 || s.w < 24 ? 'WCAG' : 'SOFT'} ${s.w}x${s.h}] ${d.name} ${path} <${s.tag}> "${s.label}"`,
      );
    for (const c of dedupe(report.clipped, (x) => x.text).slice(0, 3))
      problems.push(`[CLIPPED ${c.by}px] ${d.name} ${path} <${c.tag}> "${c.text}"`);
  }

  if (OUT) {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${d.name}-home.png` });
  }
  await ctx.close();
  console.log(`scanned ${d.name} (${d.w}x${d.h})`);
}

await browser.close();

console.log('\n================ FINDINGS ================');
if (!problems.length) console.log('none');
else for (const p of problems) console.log(p);

// TARGET-SOFT is advisory: those targets clear the WCAG 2.2 minimum of 24px and
// their density in the chrome is a deliberate choice. Everything else is a
// layout defect and fails the run.
const blocking = problems.filter((p) => !p.startsWith('[TARGET-SOFT'));
const advisory = problems.length - blocking.length;
console.log(`\n${blocking.length} blocking, ${advisory} advisory`);
process.exit(blocking.length ? 1 : 0);
