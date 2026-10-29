import { expect, test } from '@playwright/test';

test('vendor public-profile preview shows only customer-facing proof and metrics', async ({ page }, testInfo) => {
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

  await page.route('**/api/vendor/context?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        approved: true,
        vendorId: 'vendor-electro',
        membershipId: 'membership-electro',
        role: 'OWNER',
        businessName: 'Electro LLC',
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
          businessType: 'Limited Liability Company',
          category: 'Electrical Services',
          bio: 'Residential and commercial electrical work backed by verified service records.',
          website: 'https://electro.example/',
          foundedYear: 2018,
          specialties: ['Electrical Repair', 'Lighting Installation', 'Residential Rewiring'],
          location: 'Orlando, FL',
          serviceAreas: ['Orlando', 'Winter Garden', 'Ocoee'],
          businessHours: {
            configured: true,
            openNow: true,
            label: 'Open now',
            todayLabel: 'Open today, 8:00 AM–6:00 PM',
            timezone: 'America/New_York',
            schedule: [
              { day: 'mon', dayLabel: 'Monday', enabled: true, hoursLabel: '8:00 AM-6:00 PM' },
              { day: 'sun', dayLabel: 'Sunday', enabled: false, hoursLabel: 'Closed' },
            ],
          },
          profilePhoto: null,
          rating: 4.9,
          reviewCount: 27,
        },
        publicServices: [
          {
            serviceId: 'service-outlet',
            serviceName: 'Outlet Installation',
            serviceDescription: 'New outlets, replacements, and code-conscious upgrades.',
            price: 125,
            previewMediaUrl: null,
            previewMediaType: null,
          },
          {
            serviceId: 'service-panel',
            serviceName: 'Electrical Panel Service',
            serviceDescription: 'Panel inspection, repair, and replacement planning.',
            price: null,
            previewMediaUrl: null,
            previewMediaType: null,
          },
          {
            serviceId: 'service-lighting',
            serviceName: 'Lighting Installation',
            serviceDescription: 'Install customer-approved fixtures and lighting controls.',
            price: 175,
            previewMediaUrl: null,
            previewMediaType: null,
          },
          {
            serviceId: 'service-breaker',
            serviceName: 'Breaker Replacement',
            serviceDescription: 'Diagnose and replace a faulty residential breaker.',
            price: 60,
            previewMediaUrl: null,
            previewMediaType: null,
          },
          {
            serviceId: 'service-rewire',
            serviceName: 'Residential Rewiring',
            serviceDescription: 'Plan and complete residential rewiring projects.',
            price: null,
            previewMediaUrl: null,
            previewMediaType: null,
          },
        ],
        publicMedia: [
          {
            mediaId: 'media-completed-outlet',
            serviceId: 'service-outlet',
            serviceName: 'Outlet Installation',
            title: 'Completed outlet installation',
            mimeType: 'video/mp4',
            url: '/tutorials/service-videos-and-reviews.mp4',
            createdAt: '2026-10-18T14:00:00.000Z',
            stageKey: 'COMPLETED',
            stageLabel: 'Completed',
            isPrimaryServiceVideo: true,
            isPrimaryProofVideo: true,
          },
        ],
        publicProofSummary: {
          completedWorkCount: 1,
          publicMediaCount: 1,
          servicesWithPublicProof: 1,
        },
      }),
    });
  });

  await page.route('**/api/vendors/vendor-electro/reviews/public**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        reviews: [
          {
            reviewId: 'review-1',
            vendorId: 'vendor-electro',
            rating: 5,
            comment: 'Clear communication, careful work, and a clean finish.',
            createdAt: '2026-10-20T14:00:00.000Z',
            reviewerDisplayName: 'Verified Customer',
          },
          {
            reviewId: 'review-2',
            vendorId: 'vendor-electro',
            rating: 5,
            comment: 'The technician explained every option before starting.',
            createdAt: '2026-10-19T14:00:00.000Z',
            reviewerDisplayName: 'Alex C.',
          },
          {
            reviewId: 'review-3',
            vendorId: 'vendor-electro',
            rating: 4,
            comment: 'Professional service and thoughtful cleanup.',
            createdAt: '2026-10-18T14:00:00.000Z',
            reviewerDisplayName: 'Jamie R.',
          },
          {
            reviewId: 'review-4',
            vendorId: 'vendor-electro',
            rating: 5,
            comment: 'This fourth review belongs on the full reviews page.',
            createdAt: '2026-10-17T14:00:00.000Z',
            reviewerDisplayName: 'Taylor S.',
          },
        ],
        pagination: { page: 1, limit: 3, total: 4, totalPages: 2 },
      }),
    });
  });

  await page.route('**/api/vendors/vendor-electro/trust-score', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        vendorId: 'vendor-electro',
        trustScore: {
          scored: true,
          totalScorePct: 94,
          presentation: {
            maturityState: 'established',
            maturityLabel: 'Established',
            title: 'Strong verified reliability',
            scoreDisplay: '94%',
            summary: 'A strong record of completed workflows and verified Service Videos.',
            tone: 'strong',
            scoreEmphasis: 'prominent',
          },
          evidence: {
            verifiedBookings: 14,
            approvedServiceVideos: 8,
            validatedDisputes: 0,
          },
          components: {
            workflowCompletion: { pct: 100, numerator: 14, denominator: 14, weightPct: 50 },
            videoVerification: { pct: 88, numerator: 8, denominator: 9, weightPct: 30 },
            disputeFree: { pct: 100, numerator: 14, denominator: 14, weightPct: 20 },
          },
          explanationDetails: {
            overview: 'Public-safe reliability summary.',
            coverageSummary: '14 verified completed jobs.',
            strongestSignals: ['Completed workflow evidence is consistently available.'],
            watchItems: [],
            methodology: [],
          },
        },
      }),
    });
  });

  await page.goto(
    '/vendors/vendor-electro?preview=vendor&returnTo=%2Fvendor%2Fprofile&returnLabel=Back%20to%20Profile%20%26%20Settings',
    { waitUntil: 'domcontentloaded' },
  );

  await expect(page.getByTestId('vendor-public-profile-preview-banner')).toContainText(
    'This is exactly what customers can see',
  );
  await expect(page.getByRole('link', { name: 'Vendor Workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Vendor Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Electro LLC' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visit business website' })).toHaveAttribute('href', 'https://electro.example/');
  await expect(page.getByText('4.9', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('public-approved-services')).toContainText('Outlet Installation');
  await expect(page.getByTestId('public-approved-services')).toContainText('Electrical Panel Service');
  await expect(page.getByTestId('public-approved-services')).not.toContainText('Residential Rewiring');
  await expect(page.getByTestId('public-approved-services')).toContainText('Reference price: $125.00');
  await expect(page.getByRole('link', { name: 'View all 5 services' })).toHaveAttribute('href', '/vendors/vendor-electro/services');
  await expect(page.getByTestId('public-business-specialties')).toContainText('Electrical Repair');
  await expect(page.getByText('Weekly business hours')).toBeVisible();
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();
  await expect(page.getByTestId('public-work-library')).toContainText('Completed public work');
  await expect(page.getByTestId('public-work-library')).toContainText('Completed outlet installation');
  await expect(page.getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByText('Verified jobs completed', { exact: true })).toBeVisible();
  await expect(page.getByText('14', { exact: true })).toBeVisible();
  await expect(page.getByText('Clear communication, careful work, and a clean finish.')).toBeVisible();
  await expect(page.getByText('This fourth review belongs on the full reviews page.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View all 4 customer reviews' })).toHaveAttribute('href', '/vendors/vendor-electro/reviews');
  await expect(page.getByText('internal settings')).toHaveCount(0);

  await page.screenshot({
    path: `test-results/vendor-public-profile-preview-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Electro LLC' })).toBeVisible();
  await page.screenshot({
    path: `test-results/vendor-public-profile-preview-mobile-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('preview query parameters cannot expose vendor management controls without authorization', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) });
  });
  await page.route('**/api/vendor/context?**', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
  });
  await page.route('**/api/vendors/vendor-electro/public', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        vendor: {
          vendorId: 'vendor-electro',
          vendorName: 'Electro LLC',
          businessType: 'Electrical Services',
          category: 'Electrical',
          bio: 'Public provider profile.',
          website: null,
          foundedYear: null,
          specialties: [],
          location: 'Orlando, FL',
          serviceAreas: ['Orlando, FL'],
          businessHours: { configured: false, openNow: false, label: 'Hours not listed', todayLabel: null, timezone: null, schedule: [] },
          profilePhoto: null,
          rating: null,
          reviewCount: 0,
        },
        publicServices: [],
        publicMedia: [],
        publicProofSummary: { completedWorkCount: 0, publicMediaCount: 0, servicesWithPublicProof: 0 },
      }),
    });
  });
  await page.route('**/api/vendors/vendor-electro/reviews/public**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, reviews: [], pagination: { page: 1, limit: 3, total: 0, totalPages: 0 } }) });
  });
  await page.route('**/api/vendors/vendor-electro/trust-score', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false }) });
  });

  await page.goto('/vendors/vendor-electro?preview=vendor&returnTo=%2Fvendor%2Fprofile', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('vendor-public-profile-preview-banner')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Vendor Workspace' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to Profile & Settings' })).toHaveCount(0);
  await expect(page.locator('header').getByRole('link', { name: 'Sign In' })).toBeVisible();
});
