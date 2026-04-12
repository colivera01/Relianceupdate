import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');

type SmokeFixture = {
  serviceId: string;
  serviceNameSearch: string;
  customerEmail: string;
  reviewBookingId: string;
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

test('customer review: my-bookings media → window/start → quick review create', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  expect(fixture.reviewBookingId, 'global-setup must write reviewBookingId (see e2e/global-setup.ts)').toBeTruthy();

  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(fixture.customerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForSignInToLeaveLoginPage(page);

  await page.goto('/my-bookings');
  await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Past' }).click();

  const row = page.getByTestId(`my-bookings-row-${fixture.reviewBookingId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('E2E Review Smoke');

  const startWindow = page.waitForResponse(
    (r) => {
      if (!r.url().includes('/api/reviews/window/start') || r.request().method() !== 'POST') return false;
      const raw = r.request().postData();
      if (!raw) return false;
      try {
        const body = JSON.parse(raw) as { bookingId?: string };
        return body.bookingId === fixture.reviewBookingId;
      } catch {
        return false;
      }
    },
    { timeout: 60_000 }
  );

  await row.getByRole('button', { name: 'Load Authorized Media' }).click();

  const startRes = await startWindow;
  expect(startRes.ok(), await startRes.text()).toBeTruthy();
  const startJson = (await startRes.json()) as { success?: boolean; reviewWindow?: { id?: string } };
  expect(startJson.success).toBeTruthy();
  expect(startJson.reviewWindow?.id).toBeTruthy();

  const player = page.getByTestId('e2e-smart-video-player');
  await expect(player).toBeVisible({ timeout: 30_000 });
  const video = player.locator('video');
  await expect(video).toBeVisible();

  await video.evaluate((el: HTMLVideoElement) => {
    void el.play();
  });

  await page.getByRole('button', { name: 'Positive' }).click({ timeout: 45_000 });

  const quick = page.getByTestId('e2e-quick-review-panel');
  await expect(quick.getByRole('heading', { name: 'Quick Review' })).toBeVisible();

  const createReview = page.waitForResponse(
    (r) => r.url().includes('/api/reviews/create') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );

  await quick.getByRole('button', { name: 'Submit Review' }).click();

  const createRes = await createReview;
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const createJson = (await createRes.json()) as { success?: boolean; review?: { id?: string; bookingId?: string } };
  expect(createJson.success).toBeTruthy();
  expect(createJson.review?.id).toBeTruthy();
  expect(createJson.review?.bookingId).toBe(fixture.reviewBookingId);

  await expect(page.getByTestId('e2e-quick-review-panel')).toHaveCount(0);
  await expect(player.locator('.text-red-600')).toHaveCount(0);
});
