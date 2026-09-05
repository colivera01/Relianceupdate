import { expect, test, type Page } from '@playwright/test';

const bookingId = 'customer-service-record-booking';

async function installCustomerSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'customer-1',
          name: 'Reliance Demo Customer',
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
}

async function installServiceRecord(page: Page, options: { reviewed?: boolean } = {}) {
  await page.route('**/api/users/favorites**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, favorite: { id: 'vendor-favorite-1' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [],
        favorites: [],
        counts: { all: 0, services: 0, vendors: 0 },
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
      }),
    });
  });

  await page.route(new RegExp(`/api/bookings/${bookingId}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          id: bookingId,
          title: 'Breaker Replacement',
          status: 'COMPLETED',
          booking_date: '2026-08-28T14:00:00.000Z',
          service: { id: 'service-1', name: 'Breaker Replacement' },
          vendor: { id: 'vendor-1', business_name: 'Electro LLC' },
        },
        customerReview: options.reviewed ? {
          id: 'review-existing',
          rating: 5,
          comment: 'Already reviewed.',
          submittedAt: '2026-09-01T12:00:00.000Z',
          employeeRating: null,
        } : null,
        assignedServiceProfessional: {
          membershipId: 'membership-bradley',
          userId: 'employee-bradley',
          name: 'Bradley Coopers',
        },
        customerRecord: {
          lifecycle: 'COMPLETED',
          lifecycleLabel: 'Completed',
          organization: 'ACTIVE',
          archived: false,
          archiveEligible: true,
          restoreEligible: false,
          legacyRestoreBlocked: false,
          attention: { required: false, code: null, reason: null, actionLabel: null, actionHref: null },
          video: { state: 'READY', label: 'Ready' },
          review: options.reviewed
            ? { state: 'REVIEWED', label: 'Reviewed' }
            : { state: 'LEAVE_REVIEW', label: 'Leave a Review' },
          visibility: { state: 'PRIVATE', label: 'Private' },
          cancellation: null,
        },
      }),
    });
  });

  await page.route(new RegExp(`/api/bookings/${bookingId}/media$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        privateProofStatus: 'AVAILABLE',
        assets: [
          {
            id: 'asset-before',
            title: 'Starting Condition',
            type: 'video',
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            downloadUrl: '/homepage/service-video-stages/before-service.mp4',
            mimeType: 'video/mp4',
            mediaSessionId: 'session-before',
            proofStage: 'before',
          },
          {
            id: 'asset-during',
            title: 'Work in Progress',
            type: 'video',
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            downloadUrl: '/homepage/service-video-stages/during-service.mp4',
            mimeType: 'video/mp4',
            mediaSessionId: 'session-during',
            proofStage: 'during',
          },
          {
            id: 'asset-after',
            title: 'Final Result',
            type: 'video',
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            downloadUrl: '/homepage/service-video-stages/completed-service.mp4',
            mimeType: 'video/mp4',
            mediaSessionId: 'session-after',
            proofStage: 'after',
          },
        ],
      }),
    });
  });

  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        role: 'CUSTOMER',
        canDecide: true,
        visibility: {
          state: 'PRIVATE_DEFAULT',
          auditPassed: true,
          privateProofReleased: true,
          package: { id: 'package-1', version: 1, packageHash: 'package-hash', audioIncluded: false },
          visibilityDecision: null,
          proposal: null,
          legacyProposal: null,
        },
      }),
    });
  });
}

test('customer watches forward from any stage and submits separate vendor and employee ratings', async ({ page }) => {
  await installCustomerSession(page);
  await installServiceRecord(page);

  const recordingPermissionRequests: string[] = [];
  await page.route('**/api/consent/request', async (route) => {
    recordingPermissionRequests.push(route.request().url());
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  const reviewSubmissions: Array<Record<string, unknown>> = [];
  await page.route('**/api/reviews/window/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, reviewWindow: { id: 'review-window-1' } }),
    });
  });
  await page.route('**/api/reviews/create', async (route) => {
    reviewSubmissions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, review: { id: 'review-1', bookingId } }),
    });
  });

  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = async () => {
      throw new DOMException('Autoplay blocked', 'NotAllowedError');
    };
  });

  await page.goto(`/test-fixtures/customer-service-record/${bookingId}`);

  await expect(page.getByRole('heading', { name: 'Breaker Replacement' })).toBeVisible();
  await expect(page.getByText('Reliance Service Video Approved', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Service Video' })).toBeVisible();
  await expect(page.getByText('Current service-record state', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Request video access', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Approve video access first', { exact: true })).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  expect(recordingPermissionRequests).toEqual([]);

  const workInProgressCard = page.getByText('Work in Progress', { exact: true }).first().locator('..');
  await workInProgressCard.getByRole('button', { name: 'Watch' }).click();
  await expect(page.getByText('Now showing').locator('..')).toContainText('Work in Progress');
  await page.locator('video').dispatchEvent('loadeddata');
  await expect(page.getByText(/Your browser paused automatic playback/)).toBeVisible();

  await page.locator('video').dispatchEvent('ended');
  const transition = page.getByRole('status');
  await expect(transition).toContainText('Up next: Final Result');
  await expect(transition).not.toContainText('Starting Condition');
  await transition.getByRole('button', { name: 'Play now' }).click();
  await expect(page.getByText('Now showing').locator('..')).toContainText('Final Result');

  await page.getByRole('button', { name: 'Leave a review' }).first().click();
  const vendorRating = page.getByRole('radiogroup', { name: 'Rate Electro LLC' });
  const employeeRating = page.getByRole('radiogroup', { name: 'Rate Bradley Coopers' });
  await vendorRating.getByRole('radio', { name: '5 stars' }).click();
  await employeeRating.getByRole('radio', { name: '3 stars' }).click();
  await page.getByLabel('Share more about your experience (optional)').fill('Clear, professional service.');
  await page.getByRole('button', { name: 'Submit review' }).click();

  await expect(page.getByText('Thank you for your review.')).toBeVisible();
  await expect(page.getByText('Want to use Electro LLC again?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Electro LLC' }).last()).toBeVisible();
  expect(reviewSubmissions).toEqual([
    expect.objectContaining({
      bookingId,
      rating: 5,
      employeeRating: 3,
      submittedVia: 'service_record',
    }),
  ]);
  expect(recordingPermissionRequests).toEqual([]);
});

test('explicit review deep link opens the canonical form once and ignores an already-reviewed record', async ({ page }) => {
  await installCustomerSession(page);
  await installServiceRecord(page);
  let reviewWindowStarts = 0;
  await page.route('**/api/reviews/window/start', async (route) => {
    reviewWindowStarts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, reviewWindow: { id: 'review-window-direct' } }),
    });
  });

  await page.goto(`/test-fixtures/customer-service-record/${bookingId}?action=review&returnTo=%2Freviews#your-review`);
  await expect(page.getByRole('radiogroup', { name: 'Rate Electro LLC' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Review' })).toBeFocused();
  await expect.poll(() => reviewWindowStarts).toBe(1);
  await expect(page).not.toHaveURL(/action=review/);

  await page.unrouteAll({ behavior: 'wait' });
  await installCustomerSession(page);
  await installServiceRecord(page, { reviewed: true });
  reviewWindowStarts = 0;
  await page.route('**/api/reviews/window/start', async (route) => {
    reviewWindowStarts += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`/test-fixtures/customer-service-record/${bookingId}?action=review#your-review`);
  await expect(page.getByText('Reviewed', { exact: true })).toBeVisible();
  await expect(page.getByText('Already reviewed.', { exact: true })).toBeVisible();
  expect(reviewWindowStarts).toBe(0);
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`business filter scopes tabs, search, pagination, and URL state at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installCustomerSession(page);
    const requestUrls: URL[] = [];
    await page.route('**/api/bookings?**', async (route) => {
      const url = new URL(route.request().url());
      requestUrls.push(url);
      const businessId = url.searchParams.get('businessId');
      const tab = url.searchParams.get('tab') || 'upcoming';
      const search = url.searchParams.get('q') || '';
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const electro = businessId === 'business-electro';
      const records = [{
        id: electro ? `electro-${tab}-${pageNumber}` : `all-${tab}-${pageNumber}`,
        title: electro ? 'Breaker Replacement' : 'Pipe Repair',
        booking_date: '2026-09-20',
        booking_time: '10:00:00',
        status: tab === 'completed' ? 'COMPLETED' : 'PENDING',
        service: { id: electro ? 'service-breaker' : 'service-pipe', name: electro ? 'Breaker Replacement' : 'Pipe Repair' },
        vendor: { id: electro ? 'business-electro' : 'business-bravo', name: electro ? 'Electro LLC' : 'Bravo Plumbing' },
        customer_record: {
          lifecycle: tab === 'completed' ? 'COMPLETED' : 'UPCOMING',
          lifecycleLabel: tab === 'completed' ? 'Completed' : 'Upcoming',
          organization: 'ACTIVE', archived: false, archiveEligible: tab === 'completed', restoreEligible: false, legacyRestoreBlocked: false,
          attention: { required: false, code: null, reason: null, actionLabel: null, actionHref: null },
          video: { state: tab === 'completed' ? 'READY' : 'PREPARING', label: tab === 'completed' ? 'Ready' : 'Preparing' },
          review: { state: tab === 'completed' ? 'LEAVE_REVIEW' : 'UNAVAILABLE', label: tab === 'completed' ? 'Leave a Review' : 'Not Available Yet' },
          visibility: { state: 'PRIVATE', label: 'Private' }, cancellation: null,
        },
      }];
      const counts = electro
        ? { upcoming: 1, completed: 7, needs_attention: 2, cancelled: 1, archived: 3, unclassified: 0 }
        : { upcoming: 4, completed: 20, needs_attention: 3, cancelled: 2, archived: 5, unclassified: 0 };
      const totalPages = tab === 'completed' && !search ? 2 : 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookings: records,
          counts,
          selectedTab: tab,
          businesses: [
            { id: 'business-bravo', name: 'Bravo Plumbing' },
            { id: 'business-electro', name: 'Electro LLC' },
          ],
          selectedBusinessId: electro ? 'business-electro' : null,
          pagination: { page: pageNumber, limit: 10, total: totalPages === 2 ? 11 : 1, totalPages },
        }),
      });
    });
    await page.route('**/api/users/favorites**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, items: [], favorites: [], counts: { all: 0, services: 0, vendors: 0 }, pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } }) });
    });

    await page.goto('/test-fixtures/customer-service-records');
    const businessFilter = page.getByLabel('Filter by business');
    await expect(businessFilter).toHaveValue('');
    await expect(page.getByRole('tab', { name: /Completed 20/ })).toBeVisible();
    await businessFilter.selectOption('business-electro');
    await expect(page).toHaveURL(/businessId=business-electro/);
    await expect(page.getByRole('tab', { name: /Completed 7/ })).toBeVisible();

    await page.getByRole('tab', { name: /Completed 7/ }).click();
    await expect(page).toHaveURL(/tab=completed/);
    await expect(page).toHaveURL(/businessId=business-electro/);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/businessId=business-electro/);

    await page.getByPlaceholder('Search service, business, or reference').fill('Breaker');
    await expect(page).toHaveURL(/q=Breaker/);
    await expect(page).not.toHaveURL(/page=2/);
    await page.reload();
    await expect(businessFilter).toHaveValue('business-electro');
    await expect(page.getByRole('tab', { name: /Completed 7/ })).toHaveAttribute('aria-selected', 'true');
    expect(requestUrls.some((url) => url.searchParams.get('businessId') === 'business-electro' && url.searchParams.get('tab') === 'completed' && url.searchParams.get('q') === 'Breaker')).toBe(true);
  });
}

test('customer cancellation uses an accessible Reliance dialog and preserves server-confirmed state', async ({ page }) => {
  await installCustomerSession(page);
  let cancelAttempts = 0;
  let nativeDialogs = 0;
  page.on('dialog', async (dialog) => {
    nativeDialogs += 1;
    await dialog.dismiss();
  });
  await page.route('**/api/bookings?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        bookings: [{
          id: 'past-upcoming', title: 'Outlet Installation', booking_date: '2026-07-06', booking_time: '10:00:00', status: 'CONFIRMED',
          service: { id: 'service-2', name: 'Outlet Installation' }, vendor: { id: 'business-electro', name: 'Electro LLC' },
          customer_record: {
            lifecycle: 'UPCOMING', lifecycleLabel: 'Upcoming', organization: 'ACTIVE', archived: false, archiveEligible: false, restoreEligible: false, legacyRestoreBlocked: false,
            attention: { required: false, code: null, reason: null, actionLabel: null, actionHref: null }, video: { state: 'PREPARING', label: 'Preparing' },
            review: { state: 'UNAVAILABLE', label: 'Not Available Yet' }, visibility: { state: 'PRIVATE', label: 'Private' }, cancellation: null,
          },
        }],
        counts: { upcoming: 1, completed: 0, needs_attention: 0, cancelled: 0, archived: 0, unclassified: 0 },
        selectedTab: 'upcoming', businesses: [{ id: 'business-electro', name: 'Electro LLC' }], selectedBusinessId: null,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    });
  });
  await page.route('**/api/users/favorites**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, items: [], favorites: [], counts: { all: 0, services: 0, vendors: 0 }, pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } }) });
  });
  await page.route('**/api/bookings/past-upcoming/cancel', async (route) => {
    cancelAttempts += 1;
    if (cancelAttempts === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to cancel this service right now.' }) });
      return;
    }
    expect(route.request().postDataJSON()).toMatchObject({ reason: 'Schedule changed', refund_requested: false });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.goto('/test-fixtures/customer-service-records');
  await expect(page.getByText('Scheduled date has passed. Status update pending.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel service' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this service?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Reason')).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel Service' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Enter a brief reason');
  await page.getByLabel('Reason').fill('Schedule changed');
  await dialog.getByRole('button', { name: 'Cancel Service' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Unable to cancel this service right now.');
  await dialog.getByRole('button', { name: 'Cancel Service' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Service cancelled.')).toBeVisible();
  expect(nativeDialogs).toBe(0);
  expect(cancelAttempts).toBe(2);
});

test('customer playback starts on demand and a media failure offers a retry', async ({ page }) => {
  await installCustomerSession(page);
  await installServiceRecord(page);
  await page.addInitScript(() => {
    const originalLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function load() {
      const state = window as typeof window & { __serviceVideoRetryCount?: number };
      state.__serviceVideoRetryCount = (state.__serviceVideoRetryCount || 0) + 1;
      return originalLoad.call(this);
    };
  });

  await page.goto(`/test-fixtures/customer-service-record/${bookingId}`);
  await expect(page.locator('video')).toHaveCount(0);

  const startingConditionCard = page.getByText('Starting Condition', { exact: true }).first().locator('..');
  await startingConditionCard.getByRole('button', { name: 'Watch' }).click();
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await video.dispatchEvent('error');
  await expect(page.getByRole('alert').filter({ hasText: 'The Service Video could not be played.' })).toContainText(
    'The Service Video could not be played. Please try again.'
  );

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __serviceVideoRetryCount?: number }).__serviceVideoRetryCount || 0)).toBeGreaterThan(0);
});

test('completed service cards present the record, video, and one review action without media inventory clutter', async ({ page }) => {
  await installCustomerSession(page);
  await page.route('**/api/users/favorites**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [],
        favorites: [],
        counts: { all: 0, services: 0, vendors: 0 },
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
      }),
    });
  });
  const mediaRequests: string[] = [];
  const organizationRequests: Array<Record<string, unknown>> = [];
  await page.route('**/api/bookings?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        bookings: [
          {
            id: bookingId,
            user_id: 'customer-1',
            service_id: 'service-1',
            vendor_id: 'vendor-1',
            service: { id: 'service-1', name: 'Breaker Replacement', price: 275 },
            vendor: { id: 'vendor-1', name: 'Electro LLC', phone: null },
            booking_date: '2026-08-28',
            booking_time: '14:00:00',
            status: 'COMPLETED',
            total_price: 275,
            created_at: '2026-08-28T14:00:00.000Z',
            updated_at: '2026-08-28T16:00:00.000Z',
            customer_record: {
              lifecycle: 'COMPLETED',
              lifecycleLabel: 'Completed',
              organization: 'ACTIVE',
              archived: false,
              archiveEligible: true,
              restoreEligible: false,
              legacyRestoreBlocked: false,
              attention: { required: false, code: null, reason: null, actionLabel: null, actionHref: null },
              video: { state: 'READY', label: 'Ready' },
              review: { state: 'LEAVE_REVIEW', label: 'Leave a Review' },
              visibility: { state: 'PRIVATE', label: 'Private' },
              cancellation: null,
            },
          },
        ],
        counts: { upcoming: 0, completed: 1, needs_attention: 0, cancelled: 0, archived: 0, unclassified: 0 },
        selectedTab: 'completed',
        businesses: [{ id: 'vendor-1', name: 'Electro LLC' }],
        selectedBusinessId: null,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    });
  });
  await page.route(new RegExp(`/api/bookings/${bookingId}/organization$`), async (route) => {
    organizationRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, organization: 'ARCHIVED', message: 'Service Record moved to Archived.' }),
    });
  });
  await page.route(new RegExp(`/api/bookings/${bookingId}/media$`), async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/test-fixtures/customer-service-records');

  const card = page.getByTestId(`my-bookings-row-${bookingId}`);
  await expect(card).toContainText('Breaker Replacement');
  await expect(card).toContainText('Business: Electro LLC');
  await expect(card.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(card.getByText('Ready', { exact: true })).toBeVisible();
  await expect(card.getByText('Leave a Review', { exact: true })).toBeVisible();
  await expect(card.getByText('Private', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'View Service Record' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Leave a review' })).toHaveAttribute('href', /action=review/);
  await expect(card.getByText(/Featured video/i)).toHaveCount(0);
  await expect(card.getByText(/media inventory/i)).toHaveCount(0);
  await expect(card.getByText(/Refresh shared videos/i)).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Archive Service Record' }).click();
  await expect(page.getByText('Service Record moved to Archived.')).toBeVisible();
  expect(organizationRequests).toEqual([expect.objectContaining({ action: 'ARCHIVE' })]);
  expect(mediaRequests).toEqual([]);
});

test('Needs Attention is actionable and server-backed tabs expose truthful empty states', async ({ page }) => {
  await installCustomerSession(page);
  const requestUrls: string[] = [];
  await page.route('**/api/bookings?**', async (route) => {
    const url = new URL(route.request().url());
    requestUrls.push(url.toString());
    const tab = url.searchParams.get('tab') || 'upcoming';
    const attentionRecord = {
      id: 'permission-booking',
      title: 'Outlet Installation',
      booking_date: '2026-09-05',
      status: 'CONFIRMED',
      service: { id: 'service-2', name: 'Outlet Installation' },
      vendor: { id: 'vendor-2', name: 'Electro LLC' },
      customer_record: {
        lifecycle: 'UPCOMING',
        lifecycleLabel: 'Upcoming',
        organization: 'ACTIVE',
        archived: false,
        archiveEligible: false,
        restoreEligible: false,
        legacyRestoreBlocked: false,
        attention: { required: true, code: 'RECORDING_PERMISSION_REQUIRED', reason: 'Recording permission needed', actionLabel: 'Review recording request', actionHref: '/consent/token-2' },
        video: { state: 'PREPARING', label: 'Preparing' },
        review: { state: 'UNAVAILABLE', label: 'Not Available Yet' },
        visibility: { state: 'PRIVATE', label: 'Private' },
        cancellation: null,
      },
    };
    const records = tab === 'needs_attention' || tab === 'upcoming' ? [attentionRecord] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        bookings: records,
        counts: { upcoming: 1, completed: 0, needs_attention: 1, cancelled: 0, archived: 0, unclassified: 0 },
        selectedTab: tab,
        businesses: [{ id: 'vendor-2', name: 'Electro LLC' }],
        selectedBusinessId: null,
        pagination: { page: 1, limit: 10, total: records.length, totalPages: records.length ? 1 : 0 },
      }),
    });
  });

  await page.goto('/test-fixtures/customer-service-records');
  await page.getByRole('tab', { name: /Needs Attention/ }).click();
  await expect.poll(() => requestUrls.some((url) => new URL(url).searchParams.get('tab') === 'needs_attention')).toBe(true);
  const card = page.getByTestId('my-bookings-row-permission-booking');
  await expect(card).toContainText('Recording permission needed');
  await expect(card.getByRole('link', { name: 'Review recording request' })).toHaveAttribute('href', '/consent/token-2');
  await page.getByRole('tab', { name: /Cancelled/ }).click();
  await expect(page.getByText('No cancelled service records.')).toBeVisible();
  await expect.poll(() => requestUrls.some((url) => new URL(url).searchParams.get('tab') === 'cancelled')).toBe(true);
});

test('cancelled Service Record detail stays accessible without false approved-video language', async ({ page }) => {
  await installCustomerSession(page);
  await page.route(new RegExp(`/api/bookings/${bookingId}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          id: bookingId,
          title: 'Breaker Replacement',
          status: 'CANCELED',
          booking_date: '2026-08-28T14:00:00.000Z',
          service: { id: 'service-1', name: 'Breaker Replacement' },
          vendor: { id: 'vendor-1', business_name: 'Electro LLC' },
        },
        customerRecord: {
          lifecycle: 'CANCELLED',
          lifecycleLabel: 'Cancelled',
          organization: 'ACTIVE',
          archived: false,
          archiveEligible: true,
          restoreEligible: false,
          legacyRestoreBlocked: false,
          attention: { required: false },
          video: { state: 'PREPARING', label: 'Preparing' },
          review: { state: 'UNAVAILABLE', label: 'Not Available Yet' },
          visibility: { state: 'PRIVATE', label: 'Private' },
          cancellation: {
            actorLabel: 'Customer',
            reason: 'Schedule changed',
            cancelledAt: '2026-09-02T12:00:00.000Z',
          },
        },
      }),
    });
  });
  await page.route(new RegExp(`/api/bookings/${bookingId}/media$`), async (route) => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'No active Private Proof grant' }) });
  });

  await page.goto(`/test-fixtures/customer-service-record/${bookingId}`);
  await expect(page.getByText('Cancelled Service Record', { exact: true })).toBeVisible();
  await expect(page.getByText('Cancelled by:')).toBeVisible();
  await expect(page.getByText('Schedule changed', { exact: true })).toBeVisible();
  await expect(page.getByText('Reliance Service Video Approved', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your Service Video' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive Service Record' })).toBeVisible();
});
