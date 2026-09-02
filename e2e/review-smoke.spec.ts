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

async function waitForBookingDetailReady(page: Page, bookingId: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await expect(page.getByText('Service Videos').first()).toBeVisible({ timeout: 30_000 });
      return;
    } catch (error) {
      const refreshButton = page.getByRole('button', { name: 'Refresh' });
      if (attempt === 1) throw error;
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click();
      } else {
        await page.goto(`/my-bookings/${bookingId}`);
      }
      await page.waitForURL(new RegExp(`/my-bookings/${bookingId}`), { timeout: 30_000 });
    }
  }
}

test.describe.configure({ mode: 'serial' });

// This legacy seeded fixture predates Admin-approved Private Proof packages. The current
// customer Service Record smoke runs in customer-service-record.spec.ts without DB writes.
test.skip('legacy customer review fixture used playback consent before Private Proof', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  expect(fixture.reviewBookingId, 'global-setup must write reviewBookingId (see e2e/global-setup.ts)').toBeTruthy();

  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await signIn(page, fixture.customerEmail, password);

  await page.goto('/my-bookings');
  await expect(page.getByRole('heading', { name: 'My Services' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Service videos and images, when available')).toBeVisible();
  await expect(
    page.getByText('Vendors can share approved service videos or images after work is done.')
  ).toBeVisible();

  await page.goto(`/my-bookings/${fixture.reviewBookingId}`);
  await page.waitForURL(new RegExp(`/my-bookings/${fixture.reviewBookingId}`), { timeout: 30_000 });
  await waitForBookingDetailReady(page, fixture.reviewBookingId);

  const requestVideoAccess = page.getByRole('button', { name: 'Request video access' });
  if (await requestVideoAccess.isVisible().catch(() => false)) {
    await requestVideoAccess.click();
    await page.waitForURL(/\/consent\//, { timeout: 30_000 });
    await expect(page.getByText('is requesting your approval')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Approve access' }).click();
    await page.waitForURL(new RegExp(`/my-bookings/${fixture.reviewBookingId}`), { timeout: 30_000 });
    await waitForBookingDetailReady(page, fixture.reviewBookingId);
  }

  await expect
    .poll(
      async () => {
        if (await page.getByText('Your review is already submitted').isVisible().catch(() => false)) {
          return 'submitted';
        }
        if ((await page.getByTestId('e2e-smart-video-player').count()) > 0) {
          return 'player';
        }
        return 'pending';
      },
      { timeout: 30_000 }
    )
    .not.toBe('pending');

  const submittedReviewPanel = page.getByText('Your review is already submitted');
  if (await submittedReviewPanel.isVisible().catch(() => false)) {
    await expect(submittedReviewPanel).toBeVisible();
    await expect
      .poll(
        async () => {
          if (await page.getByRole('link', { name: 'Back to My Reviews' }).isVisible().catch(() => false)) {
            return 'reviews';
          }
          if (await page.getByRole('link', { name: 'Back to My Services' }).isVisible().catch(() => false)) {
            return 'services';
          }
          return 'pending';
        },
        { timeout: 20_000 }
      )
      .not.toBe('pending');
    await page.goto('/reviews');
    await expect(page.getByRole('heading', { name: 'Customer reviews stay separate from the Reliance Trust Score' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Submitted Reviews' })).toBeVisible();
    await expect(page.getByText('Verified with service videos or images').first()).toBeVisible();
    return;
  }

  const actualBookingId = fixture.reviewBookingId;

  const player = page.getByTestId('e2e-smart-video-player');
  await expect(player).toBeVisible({ timeout: 30_000 });
  const video = player.locator('video');
  await expect(video).toBeVisible();

  await video.evaluate((el: HTMLVideoElement) => {
    void el.play().catch(() => {});
    el.dispatchEvent(new Event('play'));
  });

  await player.getByRole('button', { name: 'Positive' }).click({ timeout: 45_000 });

  const quick = page.getByTestId('e2e-quick-review-panel');
  await expect(quick.getByRole('heading', { name: 'Quick Review' })).toBeVisible();

  const createReview = page.waitForResponse(
    (r) => r.url().includes('/api/reviews/create') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );

  await quick.getByRole('button', { name: 'Submit Review' }).click();

  const createRes = await createReview;
  const createJson = (await createRes.json()) as {
    success?: boolean;
    code?: string;
    review?: { id?: string; bookingId?: string };
  };
  if (createRes.status() === 409 && createJson.code === 'REVIEW_ALREADY_EXISTS') {
    expect(createJson.code).toBe('REVIEW_ALREADY_EXISTS');
  } else {
    expect(createRes.ok(), JSON.stringify(createJson)).toBeTruthy();
    expect(createJson.success).toBeTruthy();
    expect(createJson.review?.id).toBeTruthy();
    expect(createJson.review?.bookingId).toBe(actualBookingId);
  }

  await expect(page.getByTestId('e2e-quick-review-panel')).toHaveCount(0);
  await expect(player.locator('.text-red-600')).toHaveCount(0);

  await page.goto('/reviews');
  await expect(page.getByRole('heading', { name: 'Customer reviews stay separate from the Reliance Trust Score' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Submitted Reviews' })).toBeVisible();
  await expect(page.getByText('Verified with service videos or images').first()).toBeVisible();
});
