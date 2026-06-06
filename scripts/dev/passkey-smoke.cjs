const { chromium, request } = require('playwright');

const BASE_URL = 'http://localhost:3000';
const VENDOR_EMAIL = 'e2e-trust-manager@reliance.test';
const VENDOR_PASSWORD = 'E2E_Smoke_dev_only_9!';

async function main() {
  const api = await request.newContext({
    baseURL: BASE_URL,
  });

  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: VENDOR_EMAIL,
      password: VENDOR_PASSWORD,
    },
  });
  const loginJson = await loginResponse.json();
  if (!loginResponse.ok() || !loginJson.mfaRequired || !loginJson.challengeId || !loginJson.mfaCodePreview) {
    throw new Error(`Vendor login did not return an MFA challenge: ${JSON.stringify(loginJson)}`);
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
    throw new Error(`Vendor MFA verify failed: ${JSON.stringify(verifyJson)}`);
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
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto(`${BASE_URL}/vendor/secure-account`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add Passkey/i }).click();
  await page.getByText('Passkey Added').waitFor({ timeout: 20000 });

  const passkeyListResponse = await api.get('/api/passkey');
  const passkeyListJson = await passkeyListResponse.json();
  if (!passkeyListResponse.ok() || !Array.isArray(passkeyListJson.passkeys) || passkeyListJson.passkeys.length < 1) {
    throw new Error(`Passkey list did not show a registered passkey: ${JSON.stringify(passkeyListJson)}`);
  }

  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    });
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_token');
  });

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(VENDOR_EMAIL);
  await page.getByRole('button', { name: /Use Passkey/i }).click();
  await page.waitForURL('**/vendor/dashboard', { timeout: 20000 });

  console.log(
    JSON.stringify(
      {
        success: true,
        registeredPasskeys: passkeyListJson.passkeys.length,
        finalUrl: page.url(),
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
