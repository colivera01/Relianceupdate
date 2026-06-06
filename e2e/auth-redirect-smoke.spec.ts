import { test, expect, type Page } from '@playwright/test';

const CUSTOMER_EMAIL = 'e2e-smoke-customer@reliance.test';
const VENDOR_EMAIL = 'e2e-trust-manager@reliance.test';
const ADMIN_EMAIL = 'colivera080124@gmail.com';
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';
const ADMIN_PASSWORD = 'E2E_Smoke_dev_only_9!';
const BOOKING_NEXT = '/booking/cmnvdeh1n0002sop8otabf4su';

async function completeLoginFromUi(
  page: Page,
  options: { email: string; password: string; next: string }
) {
  const loginUrl = `/auth/login?next=${encodeURIComponent(options.next)}`;
  await page.goto(loginUrl);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(options.email);
  await page.getByLabel('Password', { exact: true }).fill(options.password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/auth/login'),
    { timeout: 60_000 }
  );
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  const loginResult = await loginResponse;
  expect(loginResult.ok() || loginResult.status() === 202).toBeTruthy();

  const codeInput = page.getByLabel('Sign-In Code', { exact: true });
  await expect
    .poll(
      async () => {
        if ((await codeInput.isVisible().catch(() => false)) === true) {
          return 'mfa';
        }
        return page.url().includes(loginUrl)
          ? 'pending'
          : 'redirected';
      },
      { timeout: 45_000 }
    )
    .not.toBe('pending');

  if (await codeInput.isVisible().catch(() => false)) {
    const bodyText = await page.locator('body').innerText();
    const codeMatch = bodyText.match(/Dev code preview:\s*(\d{6})/);
    expect(codeMatch?.[1], `Expected dev MFA preview code in body for ${options.email}`).toBeTruthy();
    const code = String(codeMatch?.[1] || '');
    await codeInput.fill(code);
    await expect(codeInput).toHaveValue(code);
    const verifyResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/api/auth/mfa/verify'),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Verify Code', exact: true }).click();
    const verifyResult = await verifyResponse;
    expect(verifyResult.ok()).toBeTruthy();
  }

  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

test.describe.configure({ mode: 'serial' });

test('customer login from booking-origin auth returns to booking', async ({ page }) => {
  await completeLoginFromUi(page, {
    email: CUSTOMER_EMAIL,
    password: process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD,
    next: BOOKING_NEXT,
  });

  await expect.poll(async () => page.url(), { timeout: 60_000 }).toContain(BOOKING_NEXT);
});

test('vendor login from booking-origin auth lands on vendor dashboard', async ({ page }) => {
  await completeLoginFromUi(page, {
    email: VENDOR_EMAIL,
    password: DEFAULT_PASSWORD,
    next: BOOKING_NEXT,
  });

  await expect.poll(async () => page.url(), { timeout: 60_000 }).toContain('/vendor/dashboard');
  await expect(page.getByText('Service Video Pipeline', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Promote my business', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

test('admin login from booking-origin auth lands on admin dashboard', async ({ page }) => {
  await completeLoginFromUi(page, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    next: BOOKING_NEXT,
  });

  await expect.poll(async () => page.url(), { timeout: 60_000 }).toContain('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Quick actions', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
});
