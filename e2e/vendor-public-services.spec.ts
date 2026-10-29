import { expect, test } from '@playwright/test';

test('public vendor services can be searched, filtered, and opened without cramped actions', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'vendor-user',
          name: 'Electro Manager',
          email: 'manager@electro.example',
          userType: 'vendor',
        },
      }),
    });
  });

  await page.route('**/api/vendors/vendor-electro/public', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        vendor: {
          vendorId: 'vendor-electro',
          vendorName: 'Electro LLC',
          category: 'Electrical Services',
          location: 'Orlando, FL',
        },
        publicServices: [
          {
            serviceId: 'service-outlet',
            serviceName: 'Outlet Installation',
            serviceDescription: 'Install or replace a standard residential outlet.',
            price: 125,
            previewMediaUrl: '/reliance-mark.png',
            previewMediaType: 'image',
          },
          {
            serviceId: 'service-breaker',
            serviceName: 'Breaker Replacement',
            serviceDescription: 'Diagnose and replace a faulty breaker.',
            price: 60,
            previewMediaUrl: null,
            previewMediaType: null,
          },
          {
            serviceId: 'service-lighting',
            serviceName: 'Lighting Installation',
            serviceDescription: 'Install customer-approved indoor lighting.',
            price: 200,
            previewMediaUrl: null,
            previewMediaType: null,
          },
        ],
      }),
    });
  });

  await page.goto('/vendors/vendor-electro/services', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1, name: 'Electro LLC services' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vendor Workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View service & public work' })).toHaveCount(3);

  await page.getByLabel('Search services').fill('breaker');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Breaker Replacement');

  await page.getByLabel('Search services').fill('');
  await page.getByLabel('Public media').selectOption('with-media');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Outlet Installation');

  await page.getByLabel('Public media').selectOption('all');
  await page.getByLabel('Sort').selectOption('price-low');
  await expect(page.getByRole('article').first()).toContainText('Breaker Replacement');
  await expect(page.getByRole('link', { name: 'View service & public work' }).first()).toHaveAttribute(
    'href',
    /returnTo=%2Fvendors%2Fvendor-electro%2Fservices/,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
