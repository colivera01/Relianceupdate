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
