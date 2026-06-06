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

async function signIn(page: Page, email: string, password: string) {
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  const loginJson = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;

  let authPayload = loginJson;
  if (loginResponse.status() === 202 && loginJson.mfaRequired === true) {
    const challengeId = String(loginJson.challengeId || '');
    const code = String(loginJson.mfaCodePreview || '');
    if (!challengeId || !code) {
      throw new Error(`MFA verification bootstrap failed for ${email}: ${JSON.stringify(loginJson)}`);
    }
    const verifyResponse = await page.request.post('/api/auth/mfa/verify', {
      data: {
        challengeId,
        code,
        rememberDevice: true,
      },
    });
    authPayload = (await verifyResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!verifyResponse.ok()) {
      throw new Error(`MFA verify failed for ${email}: ${JSON.stringify(authPayload)}`);
    }
  } else if (!loginResponse.ok()) {
    throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(loginJson)}`);
  }

  await page.goto('/auth/login');
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('authToken', String(token));
    localStorage.setItem('auth_token', String(token));
    document.cookie = `userId=${encodeURIComponent(String((user as { id: string }).id))}; path=/; samesite=lax`;
    document.cookie = `session_user_id=${encodeURIComponent(String((user as { id: string }).id))}; path=/; samesite=lax`;
  }, {
    user: authPayload.user,
    token: authPayload.token,
  });
  const sessionUser = authPayload.user as { userType?: string } | undefined;
  const destination =
    sessionUser?.userType === 'vendor'
      ? '/vendor/dashboard'
      : sessionUser?.userType === 'admin'
        ? '/admin/dashboard'
        : '/user-dashboard';
  await page.goto(destination);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}

const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';

test.describe.configure({ mode: 'serial' });

test('customer booking: discover → book → confirmation → my-bookings', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await signIn(page, fixture.customerEmail, password);

  await page.goto(`/service/${fixture.serviceId}`);
  await page.waitForURL(new RegExp(`/service/${fixture.serviceId}(\\?.*)?$`));

  await page.getByRole('link', { name: 'Book Now' }).click();
  await page.waitForURL(`**/booking/${fixture.serviceId}`);

  await expect
    .poll(
      async () => {
        const headingVisible = await page
          .getByRole('heading', { name: /Select Date & Time|Date & Time/i })
          .first()
          .isVisible()
          .catch(() => false);
        const hasDateSlots = (await page.locator('[data-testid^="booking-slot-date-"]').count()) > 0;
        return headingVisible || hasDateSlots;
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  await page.locator('[data-testid^="booking-slot-date-"]').first().click();
  await page.locator('[data-testid^="booking-slot-time-"]').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Enter your full name').fill('Jordan Rivera');
  await page.getByPlaceholder('Enter your email').fill('jordan.rivera@example.com');
  await page.getByPlaceholder('Enter your phone number').fill('555-0101');
  await page.getByPlaceholder('Enter the address where you need the service').fill('47-01 Queens Blvd, Queens NY');
  await page.getByRole('button', { name: 'Continue' }).click();

  const bookingPost = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/bookings'),
    { timeout: 60_000 }
  );
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  const bookingPostResponse = await bookingPost;
  const bookingPostJson = (await bookingPostResponse.json().catch(() => ({}))) as {
    booking?: { id?: string };
  };
  expect(bookingPostResponse.ok(), JSON.stringify(bookingPostJson)).toBeTruthy();

  await expect
    .poll(
      async () => {
        if (/\/confirmation\?bookingId=/.test(page.url())) return 'redirected';
        const confirmationVisible = await page
          .getByRole('heading', { name: 'Booking Confirmed!' })
          .isVisible()
          .catch(() => false);
        return confirmationVisible ? 'visible' : 'pending';
      },
      { timeout: 60_000 }
    )
    .not.toBe('pending');

  const url = page.url();
  const bookingIdMatch = url.match(/bookingId=([^&]+)/);
  const bookingId = decodeURIComponent(
    bookingIdMatch?.[1] || String(bookingPostJson.booking?.id || '')
  );
  expect(bookingId, 'booking id should be available from URL or booking POST response').toBeTruthy();

  await expect(page.getByRole('heading', { name: 'Booking Confirmed!' })).toBeVisible();
  const ref = page.getByTestId('booking-confirmation-reference');
  await expect(ref).toContainText(bookingId);

  await page.getByRole('button', { name: 'View My Services' }).click();
  await page.waitForURL(/\/my-bookings/);

  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toContainText('Booking ID:');
  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toContainText(bookingId);
});
