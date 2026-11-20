import { test, expect, type Page } from '@playwright/test';

// Smoke tests against the live Open-Meteo API (no mocks): they check that the dashboard
// renders and the hero alert tiles behave, not specific weather values.

const BASEL = {
  id: 'basel',
  name: 'Basilea',
  latitude: 47.5546368,
  longitude: 7.5532081,
  timezone: 'Europe/Zurich',
};

async function openDashboard(page: Page) {
  // Pin the location so every run starts from Basel (only on the first load of the test)
  await page.addInitScript((loc) => {
    if (sessionStorage.getItem('e2e_seeded')) return;
    sessionStorage.setItem('e2e_seeded', '1');
    localStorage.setItem('last_location', JSON.stringify(loc));
  }, BASEL);
  await page.goto('./');
  await expect(page.getByText('Cargando datos del clima')).toBeHidden({ timeout: 30_000 });
}

// Tiles = the hero alert buttons; the rain strip and the Today & Tomorrow teaser (sr-only text) are excluded
const alertTiles = (page: Page) =>
  page
    .locator('button[aria-haspopup="dialog"].rounded-2xl:not([data-rain-strip])')
    .filter({ hasNotText: /Hoy y mañana:/ });

test('dashboard loads without horizontal scroll', async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByText(/Humedad/).first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('hero shows at most 4 alert tiles before "+N más"', async ({ page }) => {
  await openDashboard(page);
  const tiles = alertTiles(page);
  const toggle = page.getByRole('button', { name: /^\+\d+ más$/ });

  if (await toggle.isVisible()) {
    await expect(tiles).toHaveCount(4);
    await toggle.click();
    expect(await tiles.count()).toBeGreaterThan(4);
    await expect(page.getByRole('button', { name: 'Mostrar menos' })).toBeVisible();
  } else {
    // 5 alerts are shown in full (never hide a single tile behind a toggle)
    expect(await tiles.count()).toBeLessThanOrEqual(5);
  }
});

test('tapping an alert tile opens the Today & Tomorrow dialog', async ({ page }) => {
  await openDashboard(page);
  const tiles = alertTiles(page);
  test.skip((await tiles.count()) === 0, 'No active alerts for Basel right now');

  await tiles.first().tap();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
