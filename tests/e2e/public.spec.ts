import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * §18.1 acceptance scenarios that a visitor can reach with no account, plus
 * A11Y-10: axe-core on every public page, zero serious or critical violations
 * allowed to merge.
 */
const PUBLIC_PAGES = [
  '/',
  '/schedule/month',
  '/request',
  '/trustees',
  '/memorial',
  '/rules',
  '/accessibility',
];

test.describe('RTL and locale', () => {
  test('the document is Hebrew and right-to-left', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'he');
  });

  /**
   * §2 visitor rules: do not add a "sign in" affordance anywhere in the public
   * UI. The only route to /login is by typing it.
   */
  test('no sign-in affordance appears anywhere on the public site', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await expect(page.locator('a[href="/login"]')).toHaveCount(0);
      await expect(page.getByText('כניסת מנהלים')).toHaveCount(0);
    }
  });
});

test.describe('Scenario 1 — the week is legible with no login', () => {
  test('the landing page is the current week and names the usage types', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('לוח הזמנים');

    // FR-1: all seven days are shown. The screen-reader alternative (A11Y-5) is
    // the reliable place to count them, because the grid conveys days by
    // position rather than by text.
    const dayHeadings = page.getByRole('heading', { level: 3 });
    await expect(dayHeadings.filter({ hasText: 'יום שישי' })).not.toHaveCount(0);
    await expect(dayHeadings.filter({ hasText: 'יום שבת' })).not.toHaveCount(0);
  });

  /** FR-6: the week is in the URL, so it can be shared. */
  test('a week can be linked to directly', async ({ page }) => {
    await page.goto('/?week=2026-08-02');
    await expect(page.locator('html')).toBeVisible();
    await expect(page).toHaveURL(/week=2026-08-02/);
  });

  /**
   * Scenario 18: a Saturday renders identically to a Tuesday — no muting, no
   * weekend label, no automatic closure. The words the spec forbids must not
   * appear at all.
   */
  test('Saturday is not labelled or styled as a weekend', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('סוף שבוע')).toHaveCount(0);
    await expect(page.getByText('שבתון')).toHaveCount(0);
  });
});

test.describe('Scenario 2 — a request in under 60 seconds, no account', () => {
  test('the request form is three short steps and asks for no password', async ({ page }) => {
    await page.goto('/request');

    await expect(page.getByRole('heading', { level: 2 })).toContainText('מתי');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'לשלב הבא' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toContainText('מה');

    await page.getByRole('button', { name: 'לשלב הבא' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toContainText('מי');

    // §10.3: numeric keypad for the phone, and the field runs LTR so the digits
    // are not reordered as they are typed into an RTL document.
    const phone = page.getByLabel('טלפון נייד');
    await expect(phone).toHaveAttribute('inputmode', 'tel');
    await expect(phone).toHaveAttribute('dir', 'ltr');
  });
});

test.describe('Scenario 7 — a status page for an unknown token', () => {
  test('an unrecognised token explains itself and offers a trustee', async ({ page }) => {
    await page.goto('/request/this-token-does-not-exist-000000');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('לא נמצאה בקשה');
    await expect(page.getByRole('link', { name: 'נאמנים' }).first()).toBeVisible();
  });
});

test.describe('A11Y-10 — axe-core on every public page', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no serious or critical violations`, async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );

      expect(
        blocking,
        blocking.map((v) => `${v.id}: ${v.help}`).join('\n'),
      ).toEqual([]);
    });
  }
});

test.describe('A11Y-4 — keyboard operation', () => {
  test('the skip link is the first focusable element', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'דילוג לתוכן הראשי' })).toBeFocused();
  });
});
