import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');
const DEFAULT_PASSWORD = 'E2E_Smoke_dev_only_9!';

type SmokeFixture = {
  customerEmail: string;
  locationEdgeCustomers: {
    preferenceOffCustomerId: string;
    missingCoordinatesCustomerId: string;
  };
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as SmokeFixture;
}

async function applySyntheticCustomerSession(
  page: import('@playwright/test').Page,
  id: string,
  email: string
) {
  await page.addInitScript(
    ({ userId, userEmail }) => {
      const userData = {
        id: userId,
        name: 'E2E Customer',
        email: userEmail,
        userType: 'customer',
      };
      window.localStorage.setItem('userData', JSON.stringify(userData));
      window.localStorage.setItem('authToken', 'temp-jwt-token');
      window.localStorage.setItem('auth_token', 'temp-jwt-token');
    },
    { userId: id, userEmail: email }
  );
  await page.context().addCookies([
    {
      name: 'userId',
      value: id,
      url: 'http://localhost:3000',
    },
    {
      name: 'session_user_id',
      value: id,
      url: 'http://localhost:3000',
    },
  ]);
}

async function signInCustomer(page: import('@playwright/test').Page, email: string, password: string) {
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  const loginJson = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;

  if (!loginResponse.ok()) {
    throw new Error(`Customer sign-in failed for ${email}: ${JSON.stringify(loginJson)}`);
  }

  await page.goto('/auth/login');
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('authToken', String(token));
    localStorage.setItem('auth_token', String(token));
    document.cookie = `userId=${encodeURIComponent(String((user as { id: string }).id))}; path=/; samesite=lax`;
    document.cookie = `session_user_id=${encodeURIComponent(String((user as { id: string }).id))}; path=/; samesite=lax`;
  }, {
    user: loginJson.user,
    token: loginJson.token,
  });
}

test('public storefront category deep link opens filtered browse results', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Trust Beyond Reviews' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('body')).not.toContainText(/\$\d/);

  await page.goto('/browse?category=Other%20Services');
  await expect(page).toHaveURL(/\/browse\?category=Other(?:%20|\+)Services$/);

  await expect(
    page.getByText('Compare customer reviews, public service videos, and disclosure-friendly promoted placements without losing the organic marketplace underneath.')
  ).toBeVisible();
  await expect(page.getByText('Customer Reviews', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Service Videos', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Clear Promoted Labels', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Counts are backend-derived public inventory')).toHaveCount(0);
  await expect(page.getByText('Distance filter is not available yet in backend discovery.')).toHaveCount(0);
  await expect(page.getByTestId('browse-category-select')).toHaveValue('Other Services', {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Toggle browse filters' }).click();
  await expect(page.getByRole('heading', { name: 'Browse Filters' })).toBeVisible();
  await expect(
    page.getByText('Distance filters unlock automatically once a browse location is set.')
  ).toBeVisible();
  await expect(page.getByTestId('browse-radius-select')).toHaveCount(0);
  await expect(page.locator('option[value="price_asc"]')).toHaveCount(0);
  await expect(page.locator('option[value="price_desc"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Browse trusted services with a clearer signal stack' })).toBeVisible();
  await expect(page.getByText('Selected filter')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Brooklyn Move-In Cleaning' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/\$\d/);

  await page.getByPlaceholder('What service do you need?').fill('Metro');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(/q=Metro/, { timeout: 30_000 });
  await expect(page).toHaveURL(/category=Other(?:\+|%20)Services/);

  await page.locator('select').nth(1).selectOption('name');
  await expect(page).toHaveURL(/sortBy=name/);
});

test('public browse covers multiple deterministic geocoded vendors', async ({ page }) => {
  await page.goto('/browse?lat=40.73061&lng=-73.935242&sortBy=distance&radiusMiles=10');

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Midtown Apartment Refresh' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Brooklyn Move-In Cleaning' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/miles away/)).toHaveCount(3);
});

test('public browse shows real distance only with coordinate origin', async ({ page }) => {
  await page.goto('/browse?q=Metro%20Apartment');

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/miles away/)).toHaveCount(0);

  await page.goto('/browse?q=Metro%20Apartment&lat=40.73061&lng=-73.935242&sortBy=distance&radiusMiles=10');

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('2.9 miles away')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/distance unavailable/i);

  await page.goto('/browse?q=Metro%20Apartment&lat=40.6413&lng=-73.7781&sortBy=distance');
  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Toggle browse filters' }).click();
  await expect(page.getByTestId('browse-radius-select')).toBeVisible();

  await page.getByTestId('browse-radius-select').selectOption('10');
  await expect(page).toHaveURL(/radiusMiles=10/);
  await expect(page.getByRole('heading', { name: 'No services found' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId('browse-radius-select').selectOption('any');
  await expect(page).not.toHaveURL(/radiusMiles=/);
  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
});

test('guest browse current-location action is explicit and session-only', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          (window as any).__geoCalls += 1;
          success({
            coords: {
              latitude: 40.73061,
              longitude: -73.935242,
              accuracy: 25,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });
  });

  await page.goto('/browse?q=Metro%20Apartment');

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
  await expect(page.getByText(/miles away/)).toHaveCount(0);
  await expect(await page.evaluate(() => (window as any).__geoCalls)).toBe(0);

  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.getByText('Showing providers near your current location')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('2.9 miles away')).toBeVisible();
  await expect(await page.evaluate(() => (window as any).__geoCalls)).toBe(1);
  await expect(page).not.toHaveURL(/lat=/);

  await page.getByRole('button', { name: 'Toggle browse filters' }).click();
  await expect(page.getByTestId('browse-radius-select')).toBeVisible();

  await page.getByRole('button', { name: 'Stop using current location' }).click();
  await expect(page.getByText('Showing providers near your current location')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);

  await page.goto('/browse?q=Metro%20Apartment&lat=40.7484&lng=-73.9857&sortBy=distance');

  await expect(page.getByText('Showing providers near your current location')).toHaveCount(0);
  await expect(page.getByText('0.0 miles away')).toBeVisible();
  await expect(page).toHaveURL(/lat=40\.7484/);
});

test('guest browse current-location denial stays friendly', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: 'Permission denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });
  });

  await page.goto('/browse?q=Metro%20Apartment');
  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.getByText('Location access was denied. You can still browse normally.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible();
  await expect(page.getByText(/miles away/)).toHaveCount(0);
});

test('signed-in customer browse uses saved location without browser prompt', async ({ page }) => {
  const fixture = readFixture();
  await signInCustomer(page, fixture.customerEmail, process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 40.6413,
              longitude: -73.7781,
              accuracy: 30,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });
  });

  await page.goto('/browse?q=Metro%20Apartment');

  await expect(page.getByText('Showing results near your saved address')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('2.9 miles away')).toBeVisible();
  await expect(page).not.toHaveURL(/lat=/);
  await expect(page.locator('body')).not.toContainText(/use my location/i);
  await page.getByRole('button', { name: 'Toggle browse filters' }).click();
  await expect(page.getByTestId('browse-radius-select')).toBeVisible();
  await expect(page).not.toHaveURL(/radiusMiles=/);

  await page.getByRole('button', { name: 'Stop for this session' }).click();
  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText('Showing providers near your current location')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/miles away/)).toHaveCount(1);
  await expect(page).not.toHaveURL(/lat=/);

  await page.goto('/browse?q=Metro%20Apartment&lat=40.7484&lng=-73.9857&sortBy=distance');

  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText('0.0 miles away')).toBeVisible();
  await expect(page).toHaveURL(/lat=40\.7484/);
});

test('saved-location assist stays off when preference disabled or coordinates missing', async ({ page }) => {
  const fixture = readFixture();
  await applySyntheticCustomerSession(
    page,
    fixture.locationEdgeCustomers.preferenceOffCustomerId,
    'e2e-location-pref-off@reliance.test'
  );
  await page.goto('/browse?q=Metro%20Apartment');

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.clear();
    document.cookie = 'userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'session_user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });
  await page.evaluate(({ missingCoordinatesCustomerId }) => {
    const userData = {
      id: missingCoordinatesCustomerId,
      name: 'E2E Missing Coordinates',
      email: 'e2e-location-missing-coords@reliance.test',
      userType: 'customer',
    };
    window.localStorage.setItem('userData', JSON.stringify(userData));
    window.localStorage.setItem('authToken', 'temp-jwt-token');
    window.localStorage.setItem('auth_token', 'temp-jwt-token');
    document.cookie = `userId=${encodeURIComponent(missingCoordinatesCustomerId)}; path=/; samesite=lax`;
    document.cookie = `session_user_id=${encodeURIComponent(missingCoordinatesCustomerId)}; path=/; samesite=lax`;
  }, { missingCoordinatesCustomerId: fixture.locationEdgeCustomers.missingCoordinatesCustomerId });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Metro Apartment Deep Clean' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
});
