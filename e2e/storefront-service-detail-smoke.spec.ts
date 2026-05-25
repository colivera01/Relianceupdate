import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, 'smoke-fixture.json');

type SmokeFixture = {
  serviceId: string;
  reviewVendorId: string;
  publicReviewComment: string;
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as SmokeFixture;
}

test('signed-out public service detail page shows trust CTAs and public review', async ({ page }) => {
  const fixture = readFixture();

  await page.goto(`/service/${fixture.serviceId}`);

  await expect(page.getByRole('heading', { level: 1, name: 'E2E Smoke Service' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Sign in to Book' })).toBeVisible();
  await expect(page.getByTestId('service-page-favorite-toggle')).toHaveAttribute(
    'aria-label',
    'Sign in to save service'
  );
  await expect(page.locator('body')).not.toContainText(/\$\d/);

  await page.getByRole('button', { name: /Reviews \(\d+\)/ }).click();
  await expect(page.getByText(fixture.publicReviewComment)).toBeVisible({ timeout: 30_000 });

  await page.goto(`/vendors/${fixture.reviewVendorId}`);
  await expect(page.getByRole('heading', { name: 'E2E Smoke Vendor' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(`a[href="/service/${fixture.serviceId}"]`)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/\$\d/);
});
