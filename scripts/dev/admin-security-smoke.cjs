const { chromium, request } = require('playwright');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'colivera080124@gmail.com';
const ADMIN_PASSWORD = 'E2E_Smoke_dev_only_9!';

async function main() {
  const api = await request.newContext({
    baseURL: BASE_URL,
  });

  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });
  const loginJson = await loginResponse.json();
  if (!loginResponse.ok() || !loginJson.mfaRequired || !loginJson.challengeId || !loginJson.mfaCodePreview) {
    throw new Error(`Admin login did not return an MFA challenge: ${JSON.stringify(loginJson)}`);
  }

  const verifyResponse = await api.post('/api/auth/mfa/verify', {
    data: {
      challengeId: loginJson.challengeId,
      code: loginJson.mfaCodePreview,
      rememberDevice: false,
    },
  });
  const verifyJson = await verifyResponse.json();
  if (!verifyResponse.ok() || !verifyJson.success || !verifyJson.user || !verifyJson.token) {
    throw new Error(`Admin MFA verify failed: ${JSON.stringify(verifyJson)}`);
  }

  const storageState = await api.storageState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState,
  });

  await context.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('userData', JSON.stringify(user));
      localStorage.setItem('authToken', token);
      localStorage.setItem('auth_token', token);
    },
    {
      user: verifyJson.user,
      token: verifyJson.token,
    }
  );

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Admin Security/i }).waitFor({ timeout: 15000 });

  await page.goto(`${BASE_URL}/admin/security`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add Passkey/i }).waitFor({ timeout: 15000 });

  console.log(
    JSON.stringify(
      {
        success: true,
        dashboardUrl: `${BASE_URL}/admin/dashboard`,
        securityUrl: page.url(),
      },
      null,
      2
    )
  );

  await browser.close();
  await api.dispose();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
