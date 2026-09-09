import { test, expect, type Page } from '@playwright/test';

const EMPLOYEE_EMAIL = 'e2e-trust-employee@reliance.test';
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';

async function gotoWithRetry(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1]
) {
  let lastError: unknown;
  const mergedOptions = {
    timeout: 30_000,
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

async function signInEmployee(page: Page, email: string, password: string) {
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  const loginJson = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;

  let authPayload = loginJson;
  if (loginResponse.status() === 202 && loginJson.mfaRequired === true) {
    const challengeId = String(loginJson.challengeId || '');
    const code = String(loginJson.mfaCodePreview || '');
    if (!challengeId || !code) {
      throw new Error(`Employee MFA bootstrap failed: ${JSON.stringify(loginJson)}`);
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
      throw new Error(`Employee MFA verify failed: ${JSON.stringify(authPayload)}`);
    }
  } else if (!loginResponse.ok()) {
    throw new Error(`Employee sign-in failed: ${JSON.stringify(loginJson)}`);
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

  await gotoWithRetry(page, '/employee/jobs');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
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

async function installSignedInNonEmployee(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'customer-without-employee-membership',
          name: 'Customer Account',
          email: 'customer@example.test',
          userType: 'customer',
          availableProfiles: ['customer'],
        },
      }),
    });
  });
  await page.route('**/api/users/*/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, availableProfiles: ['customer'] }),
    });
  });
  await page.route('**/api/employee/jobs', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        code: 'EMPLOYEE_MEMBERSHIP_REQUIRED',
        error: 'An active employee membership is required to open assigned jobs.',
      }),
    });
  });
}

test('employee jobs smoke: assigned work view stays usable', async ({ page }) => {
  await signInEmployee(page, EMPLOYEE_EMAIL, DEFAULT_PASSWORD);

  await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('/employee/jobs');
  await expect(page.getByRole('heading', { name: 'Assigned Jobs' })).toBeVisible({ timeout: 30_000 });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Employee workspace temporarily unavailable');
  expect(bodyText).not.toContain('Loading assigned jobs...');

  await expectBodyContainsAny(page, ['Device paired', 'Device not paired']);
  await expectBodyContainsAny(page, [
    'Welcome to your work view',
    'No active jobs right now',
    'Start Job',
    'Awaiting Manager Review',
    'Before / Intro',
    'Step 1 of 3',
  ]);
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`signed-in non-employee receives the access-required state at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installSignedInNonEmployee(page);

    await page.goto('/employee/jobs');

    await expect(page.getByRole('heading', { name: 'Employee access required' })).toBeVisible();
    await expect(page.getByText('does not have an active employee membership')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Customer Home' })).toHaveAttribute('href', '/user-dashboard');
    await expect(page.getByRole('link', { name: 'Sign in with another account' })).toHaveAttribute('href', '/auth/login?next=%2Femployee%2Fjobs');
    await expect(page.getByRole('heading', { name: 'Assigned Jobs' })).toHaveCount(0);
    await expect(page.getByText('Welcome to your work view')).toHaveCount(0);
  });
}
