import { expect, test, type Page } from '@playwright/test';

async function installCustomerSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'customer-1', name: 'Reliance Demo Customer', email: 'customer@example.test', userType: 'customer', availableProfiles: ['customer'] },
      }),
    });
  });
  await page.route('**/api/users/*/roles', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, availableProfiles: ['customer'] }) });
  });
}

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
] as const) {
  test.describe(`Package 3 customer portal - ${device.name}`, () => {
    test.use({ viewport: device.viewport });

    test('Reviews is actions-first and preserves immediate owner history', async ({ page }) => {
      await installCustomerSession(page);
      const requests: string[] = [];
      await page.route('**/api/reviews/me?**', async (route) => {
        requests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            ready: [{ bookingId: 'booking-ready', vendorId: 'vendor-1', vendorName: 'Electro LLC', serviceName: 'Breaker Replacement', serviceDate: '2026-09-01T12:00:00.000Z', archived: true }],
            awaiting: [
              { bookingId: 'booking-waiting-electro', vendorId: 'vendor-1', vendorName: 'Electro LLC', serviceName: 'Outlet Installation', serviceDate: '2026-09-03T12:00:00.000Z', statusMessage: 'Review will be available when your Service Video is approved.', archived: false },
              { bookingId: 'booking-waiting-bright', vendorId: 'vendor-2', vendorName: 'Bright Wire Co.', serviceName: 'Outlet Installation', serviceDate: '2026-09-04T12:00:00.000Z', statusMessage: 'Review will be available after service is completed.', archived: false },
            ],
            submitted: [{
              reviewId: 'review-1', bookingId: 'booking-reviewed', vendorName: 'Electro LLC', serviceName: 'Panel Repair', rating: 5,
              comment: 'Clear and professional.', submittedAt: '2026-09-02T12:00:00.000Z',
              employeeRating: { rating: 4, employeeName: 'Bradley Coopers' }, commentStatus: 'CHECKING', ratingStatus: 'COUNTED', ratingInvalidationReason: null,
            }],
            counts: { ready: 1, awaiting: 1, submitted: 24 },
            pagination: {
              ready: { page: 1, limit: 10, total: 1, totalPages: 1 },
              submitted: { page: 1, limit: 10, total: 24, totalPages: 3 },
            },
          }),
        });
      });

      await page.goto('/test-fixtures/customer-reviews');
      await expect(page.getByRole('heading', { name: 'Customer Reviews' })).toBeVisible();
      const waiting = page.getByRole('heading', { name: 'Reviews waiting for me' });
      const submitted = page.getByRole('heading', { name: 'Submitted Reviews' });
      await expect(waiting).toBeVisible();
      await expect(submitted).toBeVisible();
      const waitingBox = await waiting.boundingBox();
      const submittedBox = await submitted.boundingBox();
      expect(waitingBox).not.toBeNull();
      expect(submittedBox).not.toBeNull();
      expect(waitingBox!.y).toBeLessThan(submittedBox!.y);
      await expect(page.getByRole('link', { name: 'Leave Review' })).toHaveAttribute('href', /action=review/);
      await expect(page.getByText('Archived Service Record')).toBeVisible();
      await expect(page.getByText('24 submitted reviews.')).toBeVisible();
      await expect(page.getByText('Clear and professional.')).toBeVisible();
      await expect(page.getByText('Written comment being checked before public display.')).toBeVisible();
      await expect(page.getByText('Service Professional Rating · Bradley Coopers')).toBeVisible();
      await expect(page.getByText('How ratings work')).toBeVisible();
      await expect(page.getByText('Electro LLC · Sep 3, 2026')).toBeVisible();
      await expect(page.getByText('Bright Wire Co. · Sep 4, 2026')).toBeVisible();
      await expect(page.getByRole('link', { name: 'View Service Record' })).toHaveCount(3);
      await expect(page.locator('a[href*="booking-waiting-electro"]')).toHaveAttribute('href', /returnTo=%2Freviews/);
      await expect(page.locator('a[href*="booking-waiting-bright"]')).toHaveAttribute('href', /returnTo=%2Freviews/);

      await page.getByPlaceholder('Search service, Vendor, or reference').fill('Panel');
      await expect.poll(() => requests.some((url) => url.includes('search=Panel'))).toBe(true);
    });

    test('Favorites clearly separates saved public Services and Businesses with server filters', async ({ page }) => {
      await installCustomerSession(page);
      const requests: string[] = [];
      let removedVendor = false;
      await page.route(/\/api\/users\/favorites(?:\/|\?|$)/, async (route) => {
        const request = route.request();
        requests.push(request.url());
        if (request.method() === 'DELETE') {
          removedVendor = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
          return;
        }
        const url = new URL(request.url());
        const type = url.searchParams.get('type') || 'all';
        const vendor = { entityType: 'vendor', favoriteId: 'vf-1', vendorId: 'vendor-1', vendorName: 'Electro LLC', vendorCategory: 'Electrical', vendorBusinessType: 'Electrician', location: 'Orlando, FL', rating: 4.8, reviewCount: 18, serviceCount: 4, isPubliclyListed: true, favoritedAt: '2026-09-02T12:00:00.000Z' };
        const service = { entityType: 'service', favoriteId: 'sf-1', serviceId: 'service-1', serviceName: 'Breaker Replacement', serviceDescription: 'Replace a faulty breaker.', price: 275, vendorId: 'vendor-1', vendorName: 'Electro LLC', vendorCategory: 'Electrical', vendorBusinessType: 'Electrician', location: 'Orlando, FL', rating: 4.8, reviewCount: 18, previewMediaUrl: null, previewMediaType: null, publicListing: { serviceEligible: false, vendorEligible: true, hasPublicMedia: false }, favoritedAt: '2026-09-01T12:00:00.000Z' };
        const items = type === 'vendor' ? (removedVendor ? [] : [vendor]) : type === 'service' ? [service] : [...(removedVendor ? [] : [vendor]), service];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, items, favorites: items, counts: { all: removedVendor ? 1 : 2, services: 1, vendors: removedVendor ? 0 : 1 }, pagination: { page: 1, limit: 12, total: items.length, totalPages: items.length ? 1 : 0 } }),
        });
      });

      await page.goto('/test-fixtures/customer-favorites');
      await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Services 1/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Businesses 1/ })).toBeVisible();
      await expect(page.getByText('Saved Service', { exact: true })).toBeVisible();
      await expect(page.getByText('Saved Business')).toBeVisible();
      await expect(page.getByText(/completed work remains in/i)).toBeVisible();
      await expect(page.getByText('This saved Service is not currently available in Explore Proof.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'View Service' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'View Business' })).toHaveCount(2);
      await expect(page.getByText('videos, reviews, or vendors')).toHaveCount(0);

      await page.getByRole('tab', { name: /Businesses 1/ }).click();
      await expect.poll(() => requests.some((url) => url.includes('type=vendor'))).toBe(true);
      await expect(page.getByRole('heading', { name: 'Electro LLC' })).toBeVisible();
      await page.getByPlaceholder('Search saved services or businesses').fill('Electro');
      await expect.poll(() => requests.some((url) => url.includes('search=Electro'))).toBe(true);
      await page.getByRole('button', { name: 'Remove from Favorites' }).click();
      await expect(page.getByText('No saved businesses yet.')).toBeVisible();
    });

    test('Vendor profile offers an explicit Vendor favorite without auto-saving', async ({ page }) => {
      await installCustomerSession(page);
      const favoriteMutations: string[] = [];
      await page.route('**/api/vendors/vendor-1/public', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            vendor: {
              vendorId: 'vendor-1', vendorName: 'Electro LLC', businessType: 'Electrician', category: 'Electrical',
              bio: 'Residential electrical service.', location: 'Orlando, FL', serviceAreas: ['Orlando'],
              businessHours: { configured: false, openNow: null, label: 'Hours unavailable', todayLabel: null },
              profilePhoto: null, rating: 4.8, reviewCount: 18,
            },
            publicServices: [{ serviceId: 'service-1', serviceName: 'Breaker Replacement', serviceDescription: 'Replace a faulty breaker.', price: 275, previewMediaUrl: null, previewMediaType: null }],
            publicMedia: [],
          }),
        });
      });
      await page.route('**/api/vendors/vendor-1/reviews/public', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, reviews: [] }) });
      });
      await page.route('**/api/vendors/vendor-1/trust-score', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, trustScore: null }) });
      });
      await page.route('**/api/services/service-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            service: {
              id: 'service-1', name: 'Breaker Replacement', description: 'Replace a faulty breaker.', category: 'Electrical', price: 275, duration: 'Varies',
              vendor: { id: 'vendor-1', name: 'Electro LLC', location: 'Orlando, FL', phone: null, email: null, rating: 4.8, reviewCount: 18, isPubliclyListed: true, insurance: false, bonded: false },
              images: [], videos: [], videoItems: [], primaryProofVideoUrl: null, hasPrimaryProofVideo: false, publicReviewCount: 0, mediaCount: 0, status: 'active',
            },
          }),
        });
      });
      await page.route('**/api/services/service-1/reviews/public**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, reviews: [] }) });
      });
      await page.route('**/api/availability/vendor/vendor-1**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ availability: [] }) });
      });
      await page.route(/\/api\/users\/favorites(?:\/|\?|$)/, async (route) => {
        if (route.request().method() === 'POST') favoriteMutations.push('POST');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(route.request().method() === 'POST'
            ? { success: true, favorite: { entityType: 'vendor', favoriteId: 'vf-1', vendorId: 'vendor-1' } }
            : { success: true, items: [], favorites: [], counts: { all: 0, services: 0, vendors: 0 }, pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } }),
        });
      });

      await page.goto('/vendors/vendor-1');
      const save = page.getByRole('button', { name: 'Save Electro LLC' });
      await expect(save).toBeVisible();
      expect(favoriteMutations).toEqual([]);
      await save.click();
      await expect.poll(() => favoriteMutations).toEqual(['POST']);
      await page.getByRole('button', { name: 'View Work Type' }).click();
      await expect(page.getByRole('heading', { name: 'Breaker Replacement', exact: true })).toBeVisible();
      await expect(page.getByText('This Service Offered does not yet include a Public Service Video.')).toBeVisible();
    });
  });
}
