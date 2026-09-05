import { expect, test } from '@playwright/test';

test('signed-out Manager Review recovery preserves the exact destination', async ({ page }) => {
  await page.goto('/test-fixtures/vendor-manager-recovery');

  await expect(page.getByRole('heading', { name: 'Sign in to review this package' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
    'href',
    '/auth/login?next=%2Fvendor%2Fjobs%2Fjob-1%3Fview%3Dpackage'
  );
  await expect(page.getByRole('link', { name: 'Register as a vendor' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Go to customer dashboard' })).toHaveCount(0);
});

test('wrong-account recovery signs out and keeps the Manager Review return path', async ({ page }) => {
  await page.goto('/test-fixtures/vendor-manager-recovery?mode=wrong-account');

  await expect(page.getByRole('heading', { name: 'Switch account to review this package' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch Account' }).click();
  await expect(page).toHaveURL(
    /\/auth\/login\?next=%2Fvendor%2Fjobs%2Fjob-1%3Fview%3Dpackage/
  );
});

test('wrong-account recovery remains usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/test-fixtures/vendor-manager-recovery?mode=wrong-account');

  await expect(page.getByRole('button', { name: 'Switch Account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cancel' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
