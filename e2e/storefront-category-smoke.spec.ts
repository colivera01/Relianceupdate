import { test, expect } from '@playwright/test';

async function signInCustomer(page: import('@playwright/test').Page, id: string, email: string) {
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
      domain: '127.0.0.1',
      path: '/',
    },
    {
      name: 'session_user_id',
      value: id,
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}

test('public storefront category deep link opens filtered browse results', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'See what is active on Reliance' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('body')).not.toContainText(/\$\d/);

  await page.goto('/browse?category=Deep%20Cleaning');
  await expect(page).toHaveURL(/\/browse\?category=Deep(?:%20|\+)Cleaning$/);

  await expect(
    page.getByText('Browse trusted local professionals backed by real reviews and proof of completed work.')
  ).toBeVisible();
  await expect(page.getByText('Real Reviews', { exact: true })).toBeVisible();
  await expect(page.getByText('Proof Available', { exact: true })).toBeVisible();
  await expect(page.getByText('Trusted Vendors', { exact: true })).toBeVisible();
  await expect(page.getByText('Counts are backend-derived public inventory')).toHaveCount(0);
  await expect(page.getByText('Distance filter is not available yet in backend discovery.')).toHaveCount(0);
  await expect(page.getByTestId('browse-category-select')).toHaveValue('Deep Cleaning', {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Toggle browse filters' }).click();
  await expect(page.getByText('More filters coming soon.')).toBeVisible();
  await expect(page.getByTestId('browse-radius-select')).toHaveCount(0);
  await expect(page.locator('option[value="price_asc"]')).toHaveCount(0);
  await expect(page.locator('option[value="price_desc"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Deep Cleaning' })).toBeVisible();
  await expect(page.getByText('Selected filter')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'General Service Job' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/\$\d/);

  await page.getByPlaceholder('What service do you need?').fill('General');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(/q=General/, { timeout: 30_000 });
  await expect(page).toHaveURL(/category=Deep(?:\+|%20)Cleaning/);

  await page.locator('select').nth(1).selectOption('name');
  await expect(page).toHaveURL(/sortBy=name/);
});

test('public browse covers multiple deterministic geocoded vendors', async ({ page }) => {
  await page.goto('/browse?q=E2E%20Nearby&lat=40.73061&lng=-73.935242&sortBy=distance&radiusMiles=10');

  await expect(page.getByRole('heading', { name: 'E2E Nearby Midtown Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'E2E Nearby Brooklyn Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/miles away/)).toHaveCount(2);
});

test('public browse shows real distance only with coordinate origin', async ({ page }) => {
  await page.goto('/browse?q=E2E%20Smoke');

  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/miles away/)).toHaveCount(0);

  await page.goto('/browse?q=E2E%20Smoke&lat=40.73061&lng=-73.935242&sortBy=distance&radiusMiles=10');

  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('2.9 miles away')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/distance unavailable/i);

  await page.goto('/browse?q=E2E%20Smoke&lat=40.6413&lng=-73.7781&sortBy=distance');
  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
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
  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
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

  await page.goto('/browse?q=E2E%20Smoke');

  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
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

  await page.goto('/browse?q=E2E%20Smoke&lat=40.7484&lng=-73.9857&sortBy=distance');

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

  await page.goto('/browse?q=E2E%20Smoke');
  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.getByText('Location access was denied. You can still browse normally.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible();
  await expect(page.getByText(/miles away/)).toHaveCount(0);
});

test('signed-in customer browse uses saved location without browser prompt', async ({ page }) => {
  await signInCustomer(page, 'e2e-smoke-customer', 'e2e-smoke-customer@reliance.test');
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

  await page.goto('/browse?q=E2E%20Smoke');

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

  await page.goto('/browse?q=E2E%20Smoke&lat=40.7484&lng=-73.9857&sortBy=distance');

  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText('0.0 miles away')).toBeVisible();
  await expect(page).toHaveURL(/lat=40\.7484/);
});

test('saved-location assist stays off when preference disabled or coordinates missing', async ({ page }) => {
  await signInCustomer(
    page,
    'e2e-location-pref-off-customer',
    'e2e-location-pref-off@reliance.test'
  );
  await page.goto('/browse?q=E2E%20Smoke');

  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.clear();
    document.cookie = 'userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'session_user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    const userData = {
      id: 'e2e-location-missing-coords-customer',
      name: 'E2E Missing Coordinates',
      email: 'e2e-location-missing-coords@reliance.test',
      userType: 'customer',
    };
    window.localStorage.setItem('userData', JSON.stringify(userData));
    window.localStorage.setItem('authToken', 'temp-jwt-token');
    window.localStorage.setItem('auth_token', 'temp-jwt-token');
    document.cookie = 'userId=e2e-location-missing-coords-customer; path=/; samesite=lax';
    document.cookie = 'session_user_id=e2e-location-missing-coords-customer; path=/; samesite=lax';
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'E2E Smoke Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Showing results near your saved address')).toHaveCount(0);
  await expect(page.getByText(/miles away/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
});
