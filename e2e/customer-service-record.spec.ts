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

async function installServiceRecord(page: Page) {
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
        customerReview: null,
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
          review: { state: 'LEAVE_REVIEW', label: 'Leave a Review' },
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
            downloadUrl: 'data:video/mp4;base64,AAAA',
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
            downloadUrl: 'data:video/mp4;base64,AAAA',
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
            downloadUrl: 'data:video/mp4;base64,AAAA',
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
  await expect(card).toContainText('Vendor: Electro LLC');
  await expect(card.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(card.getByText('Ready', { exact: true })).toBeVisible();
  await expect(card.getByText('Leave a Review', { exact: true })).toBeVisible();
  await expect(card.getByText('Private', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'View Service Record' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Leave a review' })).toBeVisible();
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
        pagination: { page: 1, limit: 10, total: records.length, totalPages: records.length ? 1 : 0 },
      }),
    });
  });

  await page.goto('/test-fixtures/customer-service-records');
  await page.getByRole('tab', { name: /Needs Attention/ }).click();
  const card = page.getByTestId('my-bookings-row-permission-booking');
  await expect(card).toContainText('Recording permission needed');
  await expect(card.getByRole('link', { name: 'Review recording request' })).toHaveAttribute('href', '/consent/token-2');
  await page.getByRole('tab', { name: /Cancelled/ }).click();
  await expect(page.getByText('No cancelled service records.')).toBeVisible();
  expect(requestUrls.some((url) => url.includes('tab=needs_attention'))).toBe(true);
  expect(requestUrls.some((url) => url.includes('tab=cancelled'))).toBe(true);
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
