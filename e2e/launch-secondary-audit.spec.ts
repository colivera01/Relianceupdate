import { test, expect, type Page } from '@playwright/test';

const CUSTOMER_EMAIL = 'e2e-smoke-customer@reliance.test';
const VENDOR_EMAIL = 'e2e-trust-manager@reliance.test';
const EMPLOYEE_EMAIL = 'e2e-trust-employee@reliance.test';
const ADMIN_EMAIL = 'colivera080124@gmail.com';
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';
const ADMIN_PASSWORD = 'E2E_Smoke_dev_only_9!';

async function gotoWithRetry(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1]
) {
  let lastError: unknown;
  const mergedOptions = {
    timeout: 60_000,
    waitUntil: 'commit' as const,
    ...(options || {}),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(url, mergedOptions);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && /ERR_ABORTED|frame was detached/i.test(message)) {
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
    timeout: 60_000,
  });
  const loginJson = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;

  let authPayload = loginJson;
  if (loginResponse.status() === 202 && loginJson.mfaRequired === true) {
    const challengeId = String(loginJson.challengeId || '');
    const code = String(loginJson.mfaCodePreview || '');
    if (!challengeId || !code) {
      throw new Error(`MFA bootstrap failed for ${email}: ${JSON.stringify(loginJson)}`);
    }
    const verifyResponse = await page.request.post('/api/auth/mfa/verify', {
      data: {
        challengeId,
        code,
        rememberDevice: true,
      },
      timeout: 60_000,
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
}

async function expectBodyContainsAny(page: Page, options: string[]) {
  await page.waitForTimeout(1000);
  await expect
    .poll(
      async () => {
        const text = await page.locator('body').innerText();
        return options.some((option) => text.includes(option));
      },
      { timeout: 45_000 }
    )
    .toBe(true);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test('public utility pages stay usable and protected routes stay protected', async ({ page }) => {
  await gotoWithRetry(page, '/');
  await expectBodyContainsAny(page, ['Trust Beyond Reviews', 'Verified Service Videos']);

  await gotoWithRetry(page, '/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

  await gotoWithRetry(page, '/terms');
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

  await gotoWithRetry(page, '/vendor/register');
  await expect(page.getByRole('heading', { name: 'Register as a Vendor' })).toBeVisible();
  await page.getByRole('button', { name: /submit|register/i }).click();
  await expect(page.getByText(/business name/i)).toBeVisible();

});

test.skip('customer secondary surfaces stay coherent', async ({ page }) => {
  await signIn(page, CUSTOMER_EMAIL, DEFAULT_PASSWORD);

  await gotoWithRetry(page, '/messages');
  await expect(page.getByRole('heading', { name: /In-app messaging is not available on this launch/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View My Services' })).toBeVisible();

  await gotoWithRetry(page, '/profile-settings');
  await expectBodyContainsAny(page, ['Profile & Settings', 'Open Secure Account', 'Open Help Center']);

  await gotoWithRetry(page, '/customer/secure-account');
  await expectBodyContainsAny(page, ['Registered passkeys', 'Add Passkey', 'Open Help Center']);
});

test('vendor secondary pages expose honest launch surfaces and working navigation', async ({ page }) => {
  await signIn(page, VENDOR_EMAIL, DEFAULT_PASSWORD);

  await gotoWithRetry(page, '/vendor/availability');
  await expect(page.getByRole('heading', { name: /Availability scheduling is not live on this launch/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Manage Jobs' })).toBeVisible();

  await gotoWithRetry(page, '/vendor/billing');
  await expect(page.getByRole('heading', { name: /Billing and payouts are not enabled yet/i })).toBeVisible();

  await gotoWithRetry(page, '/vendor/support/contact');
  await expect(page.getByRole('heading', { name: /Support tickets are not available on this launch/i })).toBeVisible();

  await gotoWithRetry(page, '/vendor/support/chat');
  await expect(page.getByRole('heading', { name: /Live Chat Is Not Available in This Launch/i })).toBeVisible();

  await gotoWithRetry(page, '/vendor/employees');
  await expectBodyContainsAny(page, ['Team Management', 'Invite Employee', 'Team roster']);

  await gotoWithRetry(page, '/vendor/secure-account');
  await expectBodyContainsAny(page, ['Secure Your Business Account', 'Add Passkey']);
});

test('employee and admin secondary pages remain accessible and role-scoped', async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, DEFAULT_PASSWORD);
  await gotoWithRetry(page, '/employee/mobile');
  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/employee/jobs');
  await expectBodyContainsAny(page, ['Assigned Jobs', 'Device paired', 'Device not paired']);

  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await gotoWithRetry(page, '/admin/admin-users');
  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/admin/users');
  await expect(page.getByRole('heading', { name: 'Customer Overview' })).toBeVisible();

  const customerSearch = page.getByPlaceholder('Search customers...');
  await customerSearch.fill('Orlando');
  await page.getByRole('button', { name: 'Apply Search' }).click();
  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/admin/users?q=Orlando');
  await page.getByRole('link', { name: 'Clear' }).click();
  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/admin/users');

  await gotoWithRetry(page, '/admin/notifications');
  await expect(page.getByRole('heading', { name: 'Admin Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reports/i })).toBeVisible();

  await gotoWithRetry(page, '/admin/profile');
  await expect(page.getByRole('heading', { name: 'Admin Account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Admin Security' })).toBeVisible();
});
