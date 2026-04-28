import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';
const FALLBACK_VENDOR_EMAIL = 'colivera080124@gmail.com';
const FALLBACK_VENDOR_PASSWORD = 'Co080124!';

type SmokeFixture = {
  customerEmail: string;
  vendorEmail?: string;
  reviewBookingId: string;
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as SmokeFixture;
}

async function waitForSignInToLeaveLoginPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.waitForFunction(() => !window.location.pathname.includes('/auth/login'), null, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForSignInToLeaveLoginPage(page);
}

async function tryVendorSignIn(page: Page, fixtureVendorEmail: string | undefined, customerPassword: string) {
  const attempts = [
    { email: fixtureVendorEmail, password: customerPassword },
    { email: FALLBACK_VENDOR_EMAIL, password: FALLBACK_VENDOR_PASSWORD },
  ].filter((candidate): candidate is { email: string; password: string } => Boolean(candidate.email));

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      await signIn(page, attempt.email, attempt.password);
      return;
    } catch (error) {
      if (index === attempts.length - 1) throw error;
      await page.goto('/auth/login');
    }
  }
}

async function expectBodyContainsAny(page: Page, options: string[]) {
  await expect
    .poll(
      async () => {
        const text = await page.locator('body').innerText();
        return options.some((option) => text.includes(option));
      },
      { timeout: 30_000 }
    )
    .toBe(true);
}

test.describe.configure({ mode: 'serial' });

test('critical route smoke: vendor + customer proof routes', async ({ page }) => {
  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;
  const hydrationWarnings: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/hydration|didn['’]t match|server rendered html/i.test(text)) {
      hydrationWarnings.push(text);
    }
  });

  await tryVendorSignIn(page, fixture.vendorEmail, password);

  const dashboardRes = await page.goto('/vendor/dashboard');
  expect(dashboardRes?.status()).toBe(200);
  await expectBodyContainsAny(page, ['Proof Pipeline', 'Vendor account pending approval']);

  const jobsRes = await page.goto('/vendor/jobs');
  expect(jobsRes?.status()).toBe(200);
  await expectBodyContainsAny(page, ['Loading jobs...', 'Available Employees', 'No jobs found for this vendor yet.']);

  const firstJobCard = page.locator('.cursor-pointer.select-none').first();
  await expect(firstJobCard).toBeVisible({ timeout: 30_000 });
  await firstJobCard.click();
  await page.waitForURL(/\/vendor\/jobs\/[^/]+$/, { timeout: 30_000 });
  await expectBodyContainsAny(page, ['Proof Timeline', 'Job Information']);

  await page.goto('/logout');
  await signIn(page, fixture.customerEmail, password);

  const customerProofRes = await page.goto(`/my-bookings/${fixture.reviewBookingId}`);
  expect(customerProofRes?.status()).toBe(200);
  await expect(page.getByText('Customer proof')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Service Proof Timeline')).toBeVisible({ timeout: 30_000 });
  expect(hydrationWarnings).toEqual([]);
});
