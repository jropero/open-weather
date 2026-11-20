import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests (e2e/). The app is used on phones only, so only mobile profiles run.
// Unit tests stay in Vitest (src/**/*.test.ts) — see vitest.config.ts.
const PORT = 5173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    // Trailing slash matters: page.goto('./') resolves against the /t/ base path
    baseURL: `http://localhost:${PORT}/t/`,
    locale: 'es-ES',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  // Reuses the dev server if one is already running locally
  webServer: {
    command: `pnpm exec vp dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/t/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
