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
  adminId: 'epic3-phase-a-admin',
  vendorId: 'epic3-phase-a-vendor',
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
  await prisma.vendorMembership.deleteMany({ where: { vendorId: fixtures.vendorId } });
  await prisma.vendor.deleteMany({ where: { id: fixtures.vendorId } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [fixtures.customerId, fixtures.managerId, fixtures.employeeId, fixtures.adminId],
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
