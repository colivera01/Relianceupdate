import { expect, test } from '@playwright/test';

async function openVendorBusinessStep(page: import('@playwright/test').Page) {
  await page.goto('/auth/register?type=vendor');
  await page.locator('#firstName').fill('Catalog');
  await page.locator('#lastName').fill('Reviewer');
  await page.locator('#registrationContactEmail').fill('catalog.review@example.com');
  await page.locator('#phone').fill('4075550101');
  await page.locator('#smsConsent').check();
  await page.locator('#address').fill('123 Main St');

  const stateSelect = page.getByRole('combobox').first();
  await stateSelect.click();
  await page.getByRole('option', { name: 'Florida', exact: true }).click();
  await page.locator('#city').fill('Orlando');
  await page.locator('#zipCode').fill('32801');
  await page.locator('#registrationPassword').fill('CatalogReview1!');
  await page.locator('#registrationConfirmPassword').fill('CatalogReview1!');
  await page.getByRole('button', { name: 'Next: Business Information' }).click();
  await expect(page.locator('label[for="category"]')).toBeVisible();
}

test('approved vendor category catalog and draft warning work on registration', async ({ page }) => {
  await openVendorBusinessStep(page);

  const categorySelect = page.getByRole('combobox').nth(1);
  await categorySelect.click();
  const optionLabels = await page.getByRole('option').allTextContents();

  expect(optionLabels).toHaveLength(27);
  expect(optionLabels).toContain('Hair/Nail Salon');
  expect(optionLabels).toContain('Pet Grooming');
  expect(optionLabels).toContain('Other');
  expect(optionLabels).not.toContain('Nail Salon');
  expect(optionLabels).not.toContain('Pet Groomers');
  expect(optionLabels).not.toContain('Bakery');
  expect(optionLabels).not.toContain('Restaurant Owners');

  await page.getByRole('option', { name: 'Hair/Nail Salon', exact: true }).click();
  for (const service of [
    'Gel Polish Service',
    'Acrylic Nails',
    'Nail Repair',
    'Dip Powder Nails',
    'Natural Nail Care',
  ]) {
    await expect(page.getByText(service, { exact: true }).first()).toBeVisible();
  }

  await page.getByLabel('Gel Polish Service', { exact: true }).check();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('discard the service selections and drafts');
    await dialog.dismiss();
  });
  await categorySelect.click();
  await page.getByRole('option', { name: 'Electrician', exact: true }).click();
  await expect(categorySelect).toContainText('Hair/Nail Salon');

  page.once('dialog', (dialog) => dialog.accept());
  await categorySelect.click();
  await page.getByRole('option', { name: 'Electrician', exact: true }).click();
  await expect(categorySelect).toContainText('Electrician');
  await expect(page.getByText('Electrical Repair', { exact: true }).first()).toBeVisible();
});
