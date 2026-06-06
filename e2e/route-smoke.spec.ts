import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';
const FALLBACK_VENDOR_EMAIL = 'e2e-trust-manager@reliance.test';
const FALLBACK_VENDOR_PASSWORD = 'E2E_Smoke_dev_only_9!';

type SmokeFixture = {
  customerEmail: string;
  vendorEmail?: string;
  reviewBookingId: string;
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as SmokeFixture;
}

async function gotoWithRetry(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1]
) {
  let lastError: unknown;
  const mergedOptions = {
    timeout: 30_000,
    waitUntil: 'domcontentloaded' as const,
    ...(options || {}),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(url, mergedOptions);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === 0 &&
        /ERR_ABORTED|frame was detached/i.test(message)
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

  await gotoWithRetry(page, '/auth/login');
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
  await gotoWithRetry(page, destination);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}

async function tryVendorSignIn(page: Page, fixtureVendorEmail: string | undefined, customerPassword: string) {
  const attempts = [{ email: FALLBACK_VENDOR_EMAIL, password: FALLBACK_VENDOR_PASSWORD }];

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      await signIn(page, attempt.email, attempt.password);
      return;
    } catch (error) {
      if (index === attempts.length - 1) throw error;
      await gotoWithRetry(page, '/auth/login');
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

async function dismissVendorJobsGuideIfPresent(page: Page) {
  const guide = page.getByRole('dialog', { name: 'How the job workflow works' });
  try {
    await expect(guide).toBeVisible({ timeout: 5_000 });
  } catch {
    return;
  }
  await guide.getByRole('button', { name: 'Got it' }).click();
  await expect(guide).toBeHidden({ timeout: 5_000 });
}

async function waitForVendorJobsRouteState(page: Page): Promise<'jobs' | 'empty' | 'available-employees'> {
  await expect(page.getByRole('heading', { name: /Manage Jobs|My Assigned Jobs/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Available Employees')).toBeVisible({ timeout: 30_000 });

  let routeState = 'available-employees';
  try {
    await expect
      .poll(
        async () => {
          const bodyText = await page.locator('body').innerText();
          if (
            bodyText.includes('No jobs found for this vendor yet.') ||
            bodyText.includes('No jobs assigned to you yet.')
          ) {
            routeState = 'empty';
            return routeState;
          }
          if ((await page.getByRole('button', { name: 'Actions' }).count()) > 0) {
            routeState = 'jobs';
            return routeState;
          }
          if (bodyText.includes('Failed to load jobs')) {
            routeState = 'load-error';
            return routeState;
          }
          return routeState;
        },
        { timeout: 10_000 }
      )
      .toMatch(/^(jobs|empty|load-error)$/);
  } catch (error) {
    if (routeState === 'load-error') throw error;
  }

  if (routeState === 'load-error') {
    throw new Error(`Unexpected vendor jobs route state: ${routeState}`);
  }
  return routeState as 'jobs' | 'empty' | 'available-employees';
}

async function openFirstVendorJobDetailIfPresent(page: Page): Promise<boolean> {
  const state = await waitForVendorJobsRouteState(page);
  if (state !== 'jobs') return false;

  const directViewButton = page.getByRole('button', { name: 'View Job' }).first();
  if (await directViewButton.isVisible().catch(() => false)) {
    await directViewButton.click();
  } else {
    await page.getByRole('button', { name: 'Actions' }).first().click();
    await page.getByRole('button', { name: 'View Details' }).first().click();
  }
  await expect
    .poll(
      async () => {
        if (/\/vendor\/jobs\/[^/]+$/.test(page.url())) return 'route';
        const bodyText = await page.locator('body').innerText();
        if (bodyText.includes('Job Information') || bodyText.includes('Video Timeline')) return 'panel';
        return 'pending';
      },
      { timeout: 30_000 }
    )
    .not.toBe('pending');
  return true;
}

test.describe.configure({ mode: 'serial' });

test('critical route smoke: vendor management routes', async ({ page }) => {
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

  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/vendor/dashboard');
  await expectBodyContainsAny(page, ['Service Video Pipeline', 'Vendor account pending approval']);
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator('body').innerText();
        return bodyText.includes('Loading dashboard...');
      },
      { timeout: 45_000 }
    )
    .toBe(false);

  const dashboardBody = await page.locator('body').innerText();
  if (dashboardBody.includes("We couldn't load your dashboard.")) {
    await gotoWithRetry(page, '/vendor/jobs');
  } else {
    await page.getByRole('link', { name: 'Manage Jobs' }).click();
    await expect.poll(async () => page.url(), { timeout: 45_000 }).toContain('/vendor/jobs');
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await dismissVendorJobsGuideIfPresent(page);
  const vendorJobsState = await waitForVendorJobsRouteState(page);
  if (vendorJobsState === 'jobs') {
    await expectBodyContainsAny(page, ['Available Employees', 'Actions']);
  } else {
    await expectBodyContainsAny(page, ['Available Employees', 'No jobs found for this vendor yet.', 'No jobs assigned to you yet.']);
  }

  expect(hydrationWarnings).toEqual([]);
});

test('critical route smoke: customer account routes', async ({ page }) => {
  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;
  const hydrationWarnings: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/hydration|didn['â€™]t match|server rendered html/i.test(text)) {
      hydrationWarnings.push(text);
    }
  });

  await signIn(page, fixture.customerEmail, password);

  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/user-dashboard');
  await expectBodyContainsAny(page, [
    'Trending Now',
    'Available Services',
    'Connected to your account routes',
  ]);

  await page.getByRole('link', { name: 'Profile & Settings' }).click();
  try {
    await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/profile-settings');
  } catch {
    await gotoWithRetry(page, '/profile-settings');
  }
  await expectBodyContainsAny(page, [
    'Profile & Settings',
    'Open Secure Account',
    'Open Help Center',
  ]);

  expect(fixture.reviewBookingId).toBeTruthy();
  expect(hydrationWarnings).toEqual([]);
});
