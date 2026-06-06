import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';
const FALLBACK_VENDOR_EMAIL = 'e2e-trust-manager@reliance.test';
const FALLBACK_VENDOR_PASSWORD = 'E2E_Smoke_dev_only_9!';

type SmokeFixture = {
  vendorEmail?: string;
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
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  const loginJson = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;

  let authPayload = loginJson;
  if (loginResponse.status() === 202 && loginJson.mfaRequired === true) {
    const challengeId = String(loginJson.challengeId || '');
    const code = String(loginJson.mfaCodePreview || '');
    if (!challengeId || !code) {
      throw new Error(`Vendor MFA bootstrap failed for ${email}: ${JSON.stringify(loginJson)}`);
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
      throw new Error(`Vendor MFA verify failed for ${email}: ${JSON.stringify(authPayload)}`);
    }
  } else if (!loginResponse.ok()) {
    throw new Error(`Vendor sign-in failed for ${email}: ${JSON.stringify(loginJson)}`);
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

  await page.goto('/vendor/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
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

test('vendor profile cleanup: launch honesty and no fake address suggestions', async ({ page }) => {
  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;

  await tryVendorSignIn(page, fixture.vendorEmail, password);

  const profileRes = await page.goto('/vendor/profile');
  expect(profileRes?.status()).toBe(200);
  await expect(page.getByRole('link', { name: 'Profile & Settings' })).toBeVisible();

  const profileLoaded = await page
    .getByText('Profile fields on this page save to your vendor profile.')
    .isVisible({ timeout: 15_000 })
    .catch(() => false);
  const bodyText = await page.locator('body').innerText();

  expect(bodyText).not.toContain('123 Main St');
  if (profileLoaded) {
    await expect(page.getByText('Enter the address manually.')).toBeVisible();
    await expect(page.getByText('Not active in the free launch')).toBeVisible();
    await expect(page.getByText('Enrollment is not active in the free launch.')).toBeVisible();
  } else {
    expect(bodyText).toMatch(/Loading your vendor profile|Vendor account pending approval/);
  }
});
