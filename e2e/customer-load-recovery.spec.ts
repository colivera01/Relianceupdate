import { expect, test, type Page, type Route } from '@playwright/test';

async function session(page: Page) {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { authenticated: true, user: { id: 'customer-1', name: 'Customer', email: 'customer@example.test', userType: 'customer', availableProfiles: ['customer'] } } }));
  await page.route('**/api/users/*/roles', (route) => route.fulfill({ json: { success: true, availableProfiles: ['customer'] } }));
}
const pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
const counts = { upcoming: 2, completed: 4, needs_attention: 0, cancelled: 2, archived: 1, unclassified: 0 };
function records(tab = 'upcoming', name = 'Outlet Installation', page = 1) {
  return { counts, selectedTab: tab, pagination: { ...pagination, page, total: 20, totalPages: 2 }, bookings: [{ id: 'fixture-booking', service: { id: 'service-1', name }, vendor: { id: 'vendor-1', name: 'Electro LLC' }, booking_date: null, status: 'PENDING', customer_record: { lifecycle: 'UPCOMING', lifecycleLabel: 'Upcoming', archived: false, attention: { required: false }, video: { state: 'PREPARING', label: 'Preparing' }, review: { state: 'UNAVAILABLE', label: 'Unavailable' }, visibility: { label: 'Private' } } }] };
}
const fail = (route: Route) => route.fulfill({ status: 500, json: { success: false, code: 'CUSTOMER_LOAD_FAILED', message: 'Unable to load your Service Records.', correlationId: 'a93c0acb-e2a6-4c9b-8fa2-cd11bc2ff753' } });

test.beforeEach(async ({ page }) => { await session(page); });

test('records loading is unknown, initial 500 has Retry, success restores authoritative counts', async ({ page }) => {
  let respond: (() => Promise<void>) | undefined;
  let failed = true;
  await page.route('**/api/bookings?**', async (route) => {
    if (!failed) return route.fulfill({ json: records() });
    await new Promise<void>((resolve) => { respond = async () => { await fail(route); resolve(); }; });
  });
  await page.goto('/test-fixtures/customer-service-records');
  await expect(page.getByText('Loading Service Records...')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upcoming Count unavailable' })).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(0);
  await expect(page.getByText('No upcoming service records.')).toHaveCount(0);
  await expect.poll(() => Boolean(respond)).toBe(true);
  await respond!();
  await expect(page.getByRole('alert', { name: 'Load error' })).toContainText('Reference:');
  await expect(page.getByText('No upcoming service records.')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Service Record pages' })).toHaveCount(0);
  await expect(page.getByRole('alert', { name: 'Load error' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('records-error.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  failed = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('tab', { name: 'Upcoming 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Outlet Installation' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('records-success.png'), fullPage: true });
});

test('records only show an empty state after a valid empty response', async ({ page }) => {
  await page.route('**/api/bookings?**', (route) => route.fulfill({ json: { ...records(), bookings: [], counts: Object.fromEntries(Object.keys(counts).map((key) => [key, 0])), pagination } }));
  await page.goto('/test-fixtures/customer-service-records');
  await expect(page.getByText('No upcoming service records.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upcoming 0' })).toBeVisible();
});

test('malformed records success is a load error, never empty data', async ({ page }) => {
  await page.route('**/api/bookings?**', (route) => route.fulfill({ json: { bookings: [] } }));
  await page.goto('/test-fixtures/customer-service-records');
  await expect(page.getByRole('alert', { name: 'Load error' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Completed Count unavailable' })).toBeVisible();
  await expect(page.getByText('No upcoming service records.')).toHaveCount(0);
});

test('failure after success hides stale records/counts; Retry preserves tab/search/page intent', async ({ page }) => {
  let failed = false;
  const urls: URL[] = [];
  await page.route('**/api/bookings?**', (route) => {
    const url = new URL(route.request().url()); urls.push(url);
    return failed ? fail(route) : route.fulfill({ json: records(url.searchParams.get('tab') || 'upcoming', 'Outlet Installation', Number(url.searchParams.get('page') || 1)) });
  });
  await page.goto('/test-fixtures/customer-service-records');
  await expect(page.getByRole('tab', { name: 'Completed 4' })).toBeVisible();
  await page.getByRole('tab', { name: 'Completed 4' }).click();
  await page.getByRole('textbox', { name: 'Search Service Records' }).fill('Outlet');
  await expect.poll(() => urls.at(-1)?.searchParams.get('q')).toBe('Outlet');
  await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
  failed = true;
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('alert', { name: 'Load error' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Outlet Installation' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Completed Count unavailable' })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Page 2 of 2', { exact: false })).toBeVisible();
  expect(urls.at(-1)?.searchParams.get('q')).toBe('Outlet');
  expect(urls.at(-1)?.searchParams.get('tab')).toBe('completed');
});

for (const kind of ['tab', 'search', 'pagination'] as const) {
  test(`latest ${kind} request wins over delayed response`, async ({ page }) => {
    let release: (() => Promise<void>) | undefined;
    let delay = false;
    await page.route('**/api/bookings?**', async (route) => {
      const url = new URL(route.request().url());
      const body = records(url.searchParams.get('tab') || 'upcoming', delay ? 'Stale result' : 'Latest result', Number(url.searchParams.get('page') || 1));
      if (delay) {
        delay = false;
        await new Promise<void>((resolve) => { release = async () => { await route.fulfill({ json: body }).catch(() => {}); resolve(); }; });
      } else await route.fulfill({ json: body });
    });
    await page.goto('/test-fixtures/customer-service-records');
    await expect(page.getByRole('heading', { name: 'Latest result' })).toBeVisible();
    delay = true;
    if (kind === 'tab') await page.getByRole('tab', { name: 'Completed 4' }).click();
    if (kind === 'search') await page.getByRole('textbox', { name: 'Search Service Records' }).fill('old');
    if (kind === 'pagination') await page.getByRole('button', { name: 'Next page' }).click();
    await expect.poll(() => Boolean(release)).toBe(true);
    if (kind === 'search') await page.getByRole('textbox', { name: 'Search Service Records' }).fill('new');
    else await page.getByRole('tab', { name: /^Cancelled/ }).click();
    await expect(page.getByRole('heading', { name: 'Latest result' })).toBeVisible();
    await release!();
    await expect(page.getByRole('heading', { name: 'Stale result' })).toHaveCount(0);
  });
}

for (const surface of ['reviews', 'favorites'] as const) {
  test(`${surface} loading, error, Retry and authoritative empty state`, async ({ page }) => {
    let release: (() => Promise<void>) | undefined;
    let failed = true;
    const pattern = surface === 'reviews' ? '**/api/reviews/me?**' : '**/api/users/favorites?**';
    const empty = surface === 'reviews'
      ? { ready: [], awaiting: [], submitted: [], counts: { ready: 0, awaiting: 0, submitted: 0 }, pagination: { ready: pagination, submitted: pagination } }
      : { success: true, items: [], counts: { all: 0, services: 0, vendors: 0 }, pagination };
    await page.route(pattern, async (route) => {
      if (!failed) return route.fulfill({ json: empty });
      await new Promise<void>((resolve) => { release = async () => { await fail(route); resolve(); }; });
    });
    await page.goto(`/test-fixtures/customer-${surface}`);
    await expect(page.getByText(surface === 'reviews' ? 'Loading Customer Reviews...' : 'Loading Favorites...')).toBeVisible();
    if (surface === 'favorites') await expect(page.getByRole('tab', { name: 'All --' })).toBeVisible();
    await expect.poll(() => Boolean(release)).toBe(true);
    await release!();
    await expect(page.getByRole('alert', { name: 'Load error' })).toBeVisible();
    await expect(page.getByText(surface === 'reviews' ? 'No submitted reviews yet.' : 'No favorites yet.')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`${surface}-error.png`), fullPage: true });
    failed = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText(surface === 'reviews' ? 'No submitted reviews yet.' : 'No favorites yet.')).toBeVisible();
  });
}

test('dashboard summary failures are Unavailable, not zero; Retry recovers', async ({ page }) => {
  let failed = true;
  for (const [pattern, summary] of [
    ['**/api/bookings?summaryOnly=1', { activeTotal: 2 }],
    ['**/api/users/favorites?countsOnly=1', { total: 3, uniqueVendorCount: 1 }],
    ['**/api/reviews/me?summaryOnly=1', { submittedTotal: 4 }],
  ] as const) await page.route(pattern, (route) => failed ? fail(route) : route.fulfill({ json: { summary } }));
  await page.goto('/test-fixtures/customer-dashboard');
  await expect(page.getByRole('alert', { name: 'Load error' })).toContainText('Unable to load dashboard totals.');
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(4);
  await page.screenshot({ path: test.info().outputPath('dashboard-error.png'), fullPage: true });
  failed = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert', { name: 'Load error' })).toHaveCount(0);
});

test('detail loader failure is Retry/back, not missing video/review', async ({ page }) => {
  await page.route('**/api/bookings/fixture-booking', fail);
  await page.goto('/test-fixtures/customer-service-record/fixture-booking');
  await expect(page.getByRole('alert', { name: 'Load error' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to My Service Records' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Service Video' })).toHaveCount(0);
});
