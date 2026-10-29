import { expect, test } from '@playwright/test';

test('public vendor reviews support service and rating filters', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) });
  });
  await page.route('**/api/vendors/vendor-electro/public', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        vendor: { vendorId: 'vendor-electro', vendorName: 'Electro LLC' },
        publicServices: [
          { serviceId: 'service-outlet', serviceName: 'Outlet Installation' },
          { serviceId: 'service-panel', serviceName: 'Panel Service' },
        ],
      }),
    });
  });
  await page.route('**/api/vendors/vendor-electro/reviews/public**', async (route) => {
    const url = new URL(route.request().url());
    const filtered = url.searchParams.get('rating') === '5' && url.searchParams.get('serviceId') === 'service-outlet';
    const reviews = filtered
      ? [{ reviewId: 'review-1', vendorId: 'vendor-electro', serviceId: 'service-outlet', serviceName: 'Outlet Installation', rating: 5, comment: 'Careful work and a clean finish.', createdAt: '2026-10-20T14:00:00.000Z', reviewerDisplayName: 'Verified Customer' }]
      : [
          { reviewId: 'review-1', vendorId: 'vendor-electro', serviceId: 'service-outlet', serviceName: 'Outlet Installation', rating: 5, comment: 'Careful work and a clean finish.', createdAt: '2026-10-20T14:00:00.000Z', reviewerDisplayName: 'Verified Customer' },
          { reviewId: 'review-2', vendorId: 'vendor-electro', serviceId: 'service-panel', serviceName: 'Panel Service', rating: 4, comment: 'Clear communication throughout.', createdAt: '2026-09-18T14:00:00.000Z', reviewerDisplayName: 'Customer Two' },
        ];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        reviews,
        pagination: { page: 1, limit: 12, total: reviews.length, totalPages: 1 },
      }),
    });
  });

  await page.goto('/vendors/vendor-electro/reviews');
  await expect(page.getByRole('heading', { name: 'Reviews for Electro LLC' })).toBeVisible();
  await expect(page.getByText('Clear communication throughout.')).toBeVisible();

  await page.getByLabel('Service').selectOption('service-outlet');
  await page.getByLabel('Rating').selectOption('5');

  await expect(page.getByText('Careful work and a clean finish.')).toBeVisible();
  await expect(page.getByText('Clear communication throughout.')).toHaveCount(0);
  await expect(page.getByText('1 published written review')).toBeVisible();
});
