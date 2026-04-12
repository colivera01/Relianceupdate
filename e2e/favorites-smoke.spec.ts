import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');

type SmokeFixture = {
  serviceId: string;
  serviceNameSearch: string;
  customerEmail: string;
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as SmokeFixture;
}

async function waitForSignInToLeaveLoginPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

  try {
    await page.waitForFunction(
      () => !window.location.pathname.includes('/auth/login'),
      null,
      { timeout: 30_000 }
    );
  } catch {
    const url = page.url();
    const visibleText = await page.locator('body').innerText().catch(() => '(unable to read body text)');
    throw new Error(
      `Sign-in did not leave /auth/login within 30s (check credentials, API /api/auth/login, or redirects).\n` +
        `Current URL: ${url}\n\nVisible page text:\n${visibleText.slice(0, 4000)}`
    );
  }

  await page.waitForLoadState('domcontentloaded');
}

const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';

test.describe.configure({ mode: 'serial' });

test('customer favorites: discover → service → favorites on/off', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(fixture.customerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForSignInToLeaveLoginPage(page);

  // Idempotent: remove smoke service from favorites if a prior run left it.
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'My Favorites' })).toBeVisible({ timeout: 30_000 });
  const existingRow = page.getByTestId(`favorites-row-${fixture.serviceId}`);
  if ((await existingRow.count()) > 0) {
    await existingRow.getByRole('button', { name: 'Remove from favorites' }).click();
    await expect(existingRow).toHaveCount(0, { timeout: 20_000 });
  }

  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Discover Services' })).toBeVisible();
  await page.getByPlaceholder('Search for services or vendors...').fill(fixture.serviceNameSearch);
  await page.keyboard.press('Enter');
  await expect(page.locator(`a[href="/service/${fixture.serviceId}"]`)).toBeVisible({ timeout: 30_000 });
  await page.locator(`a[href="/service/${fixture.serviceId}"]`).click();
  await page.waitForURL(`**/service/${fixture.serviceId}`);

  const serviceFavorite = page.getByTestId('service-page-favorite-toggle');
  await expect(serviceFavorite).toBeVisible();
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Add to favorites');
  await serviceFavorite.click();
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Remove from favorites', { timeout: 15_000 });

  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'My Favorites' })).toBeVisible();
  const row = page.getByTestId(`favorites-row-${fixture.serviceId}`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByRole('heading', { level: 3 })).toContainText('E2E Smoke Service');

  await row.getByRole('link', { name: 'View Service' }).click();
  await page.waitForURL(`**/service/${fixture.serviceId}`);

  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Remove from favorites');
  await serviceFavorite.click();
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Add to favorites', { timeout: 15_000 });

  await page.goto('/favorites');
  await expect(page.getByTestId(`favorites-row-${fixture.serviceId}`)).toHaveCount(0, { timeout: 20_000 });
});
