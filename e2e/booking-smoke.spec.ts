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

/**
 * After Sign In: let navigation/auth settle, then require leaving `/auth/login`.
 * Does not assume a specific post-login route (e.g. `/user-dashboard`).
 */
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

test('customer booking: discover → book → confirmation → my-bookings', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(fixture.customerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForSignInToLeaveLoginPage(page);

  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Discover Services' })).toBeVisible();

  await page.getByPlaceholder('Search for services or vendors...').fill(fixture.serviceNameSearch);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'View Service' }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'View Service' }).first().click();
  await page.waitForURL(`**/service/${fixture.serviceId}`);

  await page.getByRole('button', { name: 'Book Now' }).click();
  await page.waitForURL(`**/booking/${fixture.serviceId}`);

  await expect(page.getByRole('heading', { name: 'Select Date & Time' })).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid^="booking-slot-date-"]').first().click();
  await page.locator('[data-testid^="booking-slot-time-"]').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Enter your full name').fill('E2E Smoke Client');
  await page.getByPlaceholder('Enter your email').fill('e2e-client@reliance.test');
  await page.getByPlaceholder('Enter your phone number').fill('555-0101');
  await page.getByPlaceholder('Enter the address where you need the service').fill('100 Smoke Test Rd, Orlando FL');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await page.waitForURL(/\/confirmation\?bookingId=/, { timeout: 60_000 });
  const url = page.url();
  const bookingIdMatch = url.match(/bookingId=([^&]+)/);
  expect(bookingIdMatch?.[1], 'confirmation URL should include bookingId').toBeTruthy();
  const bookingId = decodeURIComponent(bookingIdMatch![1]);

  await expect(page.getByRole('heading', { name: 'Booking Confirmed!' })).toBeVisible();
  const ref = page.getByTestId('booking-confirmation-reference');
  await expect(ref).toContainText(bookingId);

  await page.getByRole('button', { name: 'View All Bookings' }).click();
  await page.waitForURL(/\/my-bookings/);

  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toContainText('Booking ID:');
  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toContainText(bookingId);
});
