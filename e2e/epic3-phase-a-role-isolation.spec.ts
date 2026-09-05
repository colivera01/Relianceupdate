import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext } from '@playwright/test';
import { createAuthSessionCookie } from '../src/lib/auth-session';

loadEnv({ path: path.join(process.cwd(), '.env.local') });
loadEnv({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const root = path.join(
  process.cwd(),
  'Project Management',
  'Epic 3 - Trusted Accounts and Role Isolation',
  '08_Screenshots'
);

const fixtures = {
  customerId: 'epic3-phase-a-customer',
  managerId: 'epic3-phase-a-manager',
  employeeId: 'epic3-phase-a-employee',
  wrongManagerId: 'epic3-phase-a-wrong-manager',
  adminId: 'epic3-phase-a-admin',
  vendorId: 'epic3-phase-a-vendor',
  wrongVendorId: 'epic3-phase-a-wrong-vendor',
  serviceId: 'epic3-phase-a-service',
  jobId: 'epic3-phase-a-manager-review-job',
};

function token(userId: string, userType: 'customer' | 'vendor' | 'admin') {
  return createAuthSessionCookie({
    userId,
    email: `${userId}@reliance.test`,
    userType,
    availableProfiles: [userType],
  });
}

async function setGeneralSession(
  context: BrowserContext,
  userId: string,
  userType: 'customer' | 'vendor'
) {
  await context.addCookies([
    {
      name: 'reliance_session',
      value: token(userId, userType),
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function setAdminSession(context: BrowserContext, userId: string) {
  const value = token(userId, 'admin');
  await context.addCookies([
    {
      name: 'reliance_admin_session',
      value,
      domain: new URL(baseURL).hostname,
      path: '/admin',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
    {
      name: 'reliance_admin_api_session',
      value,
      domain: new URL(baseURL).hostname,
      path: '/api/admin',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  for (const [id, name] of [
    [fixtures.customerId, 'Phase A Customer'],
    [fixtures.managerId, 'Phase A Manager'],
    [fixtures.employeeId, 'Phase A Employee'],
    [fixtures.wrongManagerId, 'Phase A Wrong Vendor Manager'],
    [fixtures.adminId, 'Phase A Admin'],
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name, email: `${id}@reliance.test`, accountStatus: 'active', demo: true },
      update: { name, accountStatus: 'active' },
    });
  }

  await prisma.vendor.upsert({
    where: { id: fixtures.vendorId },
    create: {
      id: fixtures.vendorId,
      name: 'Phase A Test Services',
      businessName: 'Phase A Test Services',
      email: 'epic3-phase-a-vendor@reliance.test',
      accountStatus: 'active',
      demo: true,
    },
    update: { accountStatus: 'active' },
  });

  await prisma.vendor.upsert({
    where: { id: fixtures.wrongVendorId },
    create: {
      id: fixtures.wrongVendorId,
      name: 'Different Test Services',
      businessName: 'Different Test Services',
      email: 'epic3-phase-a-wrong-vendor@reliance.test',
      accountStatus: 'active',
      demo: true,
    },
    update: { accountStatus: 'active' },
  });

  await prisma.vendorMembership.upsert({
    where: {
      vendorId_userId: { vendorId: fixtures.vendorId, userId: fixtures.managerId },
    },
    create: {
      id: 'epic3-phase-a-manager-membership',
      vendorId: fixtures.vendorId,
      userId: fixtures.managerId,
      role: 'MANAGER',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
    update: { role: 'MANAGER', status: 'ACTIVE', revokedAt: null },
  });

  await prisma.vendorMembership.upsert({
    where: {
      vendorId_userId: {
        vendorId: fixtures.wrongVendorId,
        userId: fixtures.wrongManagerId,
      },
    },
    create: {
      id: 'epic3-phase-a-wrong-manager-membership',
      vendorId: fixtures.wrongVendorId,
      userId: fixtures.wrongManagerId,
      role: 'MANAGER',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
    update: { role: 'MANAGER', status: 'ACTIVE', revokedAt: null },
  });

  await prisma.service.upsert({
    where: { id: fixtures.serviceId },
    create: {
      id: fixtures.serviceId,
      vendorId: fixtures.vendorId,
      name: 'Manager Review Test Service',
      price: 100,
      demo: true,
      isPublished: true,
    },
    update: { vendorId: fixtures.vendorId, isPublished: true },
  });

  await prisma.booking.upsert({
    where: { id: fixtures.jobId },
    create: {
      id: fixtures.jobId,
      userId: fixtures.customerId,
      serviceId: fixtures.serviceId,
      vendorId: fixtures.vendorId,
      title: 'Manager Review Test Service',
      clientName: 'Phase A Customer',
      status: 'AWAITING_REVIEW',
      demo: true,
    },
    update: { status: 'AWAITING_REVIEW' },
  });

  await prisma.vendorMembership.upsert({
    where: {
      vendorId_userId: { vendorId: fixtures.vendorId, userId: fixtures.employeeId },
    },
    create: {
      id: 'epic3-phase-a-employee-membership',
      vendorId: fixtures.vendorId,
      userId: fixtures.employeeId,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
    update: { role: 'EMPLOYEE', status: 'ACTIVE', revokedAt: null },
  });

  await prisma.platformRoleGrant.upsert({
    where: { userId_role: { userId: fixtures.adminId, role: 'ADMIN' } },
    create: {
      id: 'epic3-phase-a-admin-grant',
      userId: fixtures.adminId,
      role: 'ADMIN',
      status: 'ACTIVE',
      reason: 'Disposable Phase A browser fixture',
    },
    update: { status: 'ACTIVE', revokedAt: null },
  });
});

test.afterAll(async () => {
  await prisma.platformRoleGrant.deleteMany({ where: { userId: fixtures.adminId } });
  await prisma.booking.deleteMany({ where: { id: fixtures.jobId } });
  await prisma.service.deleteMany({ where: { id: fixtures.serviceId } });
  await prisma.vendorMembership.deleteMany({
    where: { vendorId: { in: [fixtures.vendorId, fixtures.wrongVendorId] } },
  });
  await prisma.vendor.deleteMany({
    where: { id: { in: [fixtures.vendorId, fixtures.wrongVendorId] } },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          fixtures.customerId,
          fixtures.managerId,
          fixtures.employeeId,
          fixtures.wrongManagerId,
          fixtures.adminId,
        ],
      },
    },
  });
  await prisma.$disconnect();
});

test('customer session cannot open vendor or admin routes', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.customerId, 'customer');

  await page.goto('/vendor/dashboard');
  await expect(page.getByRole('heading', { name: 'Vendor access required' })).toBeVisible();
  await page.screenshot({
    path: path.join(root, 'Desktop', 'customer-blocked-from-vendor.png'),
    fullPage: true,
  });

  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.screenshot({
    path: path.join(root, 'After', 'general-session-cannot-open-admin.png'),
    fullPage: true,
  });
});

test('current manager membership opens the exact vendor shell', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.managerId, 'vendor');

  await page.goto('/vendor/dashboard');
  await expect(page.getByRole('heading', { name: 'Vendor access required' })).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'See what is helping your business grow' })
  ).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(root, 'Desktop', 'manager-vendor-dashboard.png'),
    fullPage: true,
  });
});

test('employee membership cannot exercise manager profile authority', async ({ request }) => {
  const response = await request.put('/api/vendor/profile', {
    headers: {
      cookie: `reliance_session=${token(fixtures.employeeId, 'vendor')}`,
      'content-type': 'application/json',
    },
    data: { businessName: 'Unauthorized change' },
  });

  expect(response.status()).toBe(403);
});

test('database grant plus admin-scoped session opens admin', async ({ page, context }) => {
  await setAdminSession(context, fixtures.adminId);

  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible();
  await page.screenshot({
    path: path.join(root, 'Desktop', 'database-granted-admin-dashboard.png'),
    fullPage: true,
  });
});

test('mobile wrong-role state stays clear and protected', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setGeneralSession(context, fixtures.customerId, 'customer');

  await page.goto('/vendor/dashboard');
  await expect(page.getByRole('heading', { name: 'Vendor access required' })).toBeVisible();
  await page.screenshot({
    path: path.join(root, 'Mobile', 'customer-blocked-from-vendor-mobile.png'),
    fullPage: true,
  });
});

test('signed-out Manager Review email link preserves its exact sign-in destination', async ({ page }) => {
  await page.goto(`/vendor/jobs/${fixtures.jobId}?view=package`);

  await expect(page.getByRole('heading', { name: 'Sign in to review this package' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
    'href',
    `/auth/login?next=%2Fvendor%2Fjobs%2F${fixtures.jobId}%3Fview%3Dpackage`
  );
  await expect(page.getByRole('link', { name: 'Register as a vendor' })).toHaveCount(0);
});

test('customer session can switch accounts and retain the exact Manager Review destination', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.customerId, 'customer');
  await page.goto(`/vendor/jobs/${fixtures.jobId}?view=package`);

  await expect(page.getByRole('heading', { name: 'Switch account to review this package' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register as a vendor' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Go to customer dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch Account' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/auth/login\\?next=%2Fvendor%2Fjobs%2F${fixtures.jobId}%3Fview%3Dpackage`)
  );
});

test('wrong Vendor Manager cannot open another Vendor manager-review job', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.wrongManagerId, 'vendor');
  await page.goto(`/vendor/jobs/${fixtures.jobId}`);

  await expect(
    page.getByRole('heading', { name: 'You do not have access to this Service Record' })
  ).toBeVisible();
  await expect(page.getByText('Phase A Customer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch Account' })).toBeVisible();
});

test('Employee membership cannot open Manager Review', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.employeeId, 'vendor');
  await page.goto(`/vendor/jobs/${fixtures.jobId}`);

  await expect(
    page.getByRole('heading', { name: 'You do not have access to this Service Record' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch Account' })).toBeVisible();
});

test('correct Vendor Manager opens the exact Manager Review job', async ({ page, context }) => {
  await setGeneralSession(context, fixtures.managerId, 'vendor');
  await page.goto(`/vendor/jobs/${fixtures.jobId}`);

  await expect(
    page.getByRole('heading', { name: 'You do not have access to this Service Record' })
  ).toHaveCount(0);
  await expect(page.getByText('Manager Review Test Service', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
});
