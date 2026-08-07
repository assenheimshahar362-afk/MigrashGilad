import { defineConfig, devices } from '@playwright/test';

/**
 * §18.2 E2E layer: the acceptance scenarios, run in an RTL locale, plus
 * axe-core on every public page (A11Y-10).
 *
 * The locale and timezone are pinned. A suite that passes only because the CI
 * runner happens to be in UTC would miss exactly the DST and bidi bugs it is
 * here to catch.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // The product is used one-handed on a phone at the pitch gate (§1.4), so
      // the mobile viewport is the primary target, not an afterthought.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
