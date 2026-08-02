import { expect, test } from '@playwright/test';

type PublicProofResult = {
  serviceId: string;
  serviceName: string;
  vendorId: string;
};

async function loadPublicProofResult(page: import('@playwright/test').Page): Promise<PublicProofResult> {
  const response = await page.request.get('/api/services/discover');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { results?: PublicProofResult[] };
  const result = body.results?.[0];
  if (!result) throw new Error('Proof-first shell test requires one approved public proof result.');
  return result;
}

test('homepage explains the proof-first product before asking for an account', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Reliance', exact: true })).toBeVisible();
  await expect(
    page.getByText('See real completed work before you decide who to trust.', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer Reviews', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Public Service Videos', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reliance Trust Score', exact: true })).toBeVisible();
  await expect(page.getByText('Future promotional video coming soon')).toHaveCount(0);
  await expect(page.locator('a[href="/browse"]')).not.toHaveCount(0);
});

test('Explore Proof keeps proof signals distinct and preserves the supporting request route', async ({ page }) => {
  const proofResult = await loadPublicProofResult(page);

  await page.goto('/browse');
  await expect(
    page.getByRole('heading', {
      name: 'Explore real completed work before you choose who to trust',
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Compare approved Public Service Videos, genuine customer reviews, Reliance Trust Score, and Services Offered as separate signals.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: proofResult.serviceName, exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('body')).not.toContainText('Promoted Listings');

  await page.goto(`/service/${proofResult.serviceId}?returnTo=%2Fbrowse&returnLabel=Back%20to%20Explore%20Proof`);
  await expect(page.getByText('Review proof before you choose', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.locator(`a[href*="next=%2Fbooking%2F${proofResult.serviceId}"]`)
  ).not.toHaveCount(0);
  await expect(page.getByText('Reliance Listing')).toHaveCount(0);
});

test('public provider profile leads with credibility and keeps Services Offered separate', async ({ page }) => {
  const proofResult = await loadPublicProofResult(page);

  await page.goto(`/vendors/${proofResult.vendorId}`);
  await expect(page.getByRole('heading', { name: 'Reliance Trust Score', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Customer feedback', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Services Offered', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent public service videos', exact: true })).toBeVisible();
});

test('signed-out role routes remain blocked without exposing role controls', async ({ page }) => {
  await page.goto('/vendor/dashboard');
  await expect(page.getByRole('heading', { name: 'Vendor access required', exact: true })).toBeVisible();
  await expect(page.getByText('Manage Jobs')).toHaveCount(0);

  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Admin access required', exact: true })).toBeVisible();
  await expect(page.getByText('Permission Audit')).toHaveCount(0);
});

test('primary public pages fit a narrow mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/', '/browse']) {
    await page.goto(route);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});
