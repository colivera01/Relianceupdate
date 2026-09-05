import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');

type SmokeFixture = {
  serviceId: string;
  serviceName: string;
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

test('customer favorites: discover → service → favorites on/off', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await signIn(page, fixture.customerEmail, password);

  // Idempotent: remove smoke service from favorites if a prior run left it.
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'My Favorites' })).toBeVisible({ timeout: 30_000 });
  const existingRow = page.getByTestId(`favorites-row-${fixture.serviceId}`);
  if ((await existingRow.count()) > 0) {
    await existingRow.getByRole('button', { name: 'Remove from favorites' }).click();
    await expect(existingRow).toHaveCount(0, { timeout: 20_000 });
  }

  await page.goto(`/service/${fixture.serviceId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(new RegExp(`/service/${fixture.serviceId}(\\?.*)?$`));
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const serviceFavorite = page.getByTestId('service-page-favorite-toggle');
  try {
    await expect(serviceFavorite).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (
      bodyText.includes('Loading service details...') ||
      bodyText.includes('Service details took too long to load. Please retry.') ||
      bodyText.includes('Retry')
    ) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await expect(serviceFavorite).toBeVisible({ timeout: 30_000 });
    } else {
      throw error;
    }
  }
  await expect
    .poll(async () => await serviceFavorite.getAttribute('aria-label'), { timeout: 30_000 })
    .not.toBe('Checking favorite status');
  if ((await serviceFavorite.getAttribute('aria-label')) === 'Remove saved service') {
    await serviceFavorite.click();
    await expect(serviceFavorite).toHaveAttribute('aria-label', 'Save service', { timeout: 15_000 });
  }
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Save service');
  await serviceFavorite.click();
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Remove saved service', { timeout: 15_000 });

  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'My Favorites' })).toBeVisible();
  const row = page.getByTestId(`favorites-row-${fixture.serviceId}`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByRole('heading', { level: 3 })).toContainText(fixture.serviceName);
  await expect(row).toContainText('Reference estimate:');

  await row.getByRole('link', { name: 'View Service' }).click();
  await page.waitForURL(new RegExp(`/service/${fixture.serviceId}(\\?.*)?$`));

  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Remove saved service');
  await serviceFavorite.click();
  await expect(serviceFavorite).toHaveAttribute('aria-label', 'Save service', { timeout: 15_000 });

  await page.goto('/favorites');
  await expect(page.getByTestId(`favorites-row-${fixture.serviceId}`)).toHaveCount(0, { timeout: 20_000 });
});
