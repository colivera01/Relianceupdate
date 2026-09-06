import { expect, test, type Page } from "@playwright/test";

const vendorId = "vendor-notification-fixture";
const notificationId = "notification-manager-pass";

async function installVendorNotificationFixture(page: Page) {
  let read = false;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "manager-user-1",
            name: "Morgan Manager",
            email: "manager@example.test",
            userType: "vendor",
            availableProfiles: ["vendor"],
          },
        }),
      });
      return;
    }
    if (pathname === "/api/vendor/profile") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          profile: {
            id: vendorId,
            name: "Electro LLC",
            businessName: "Electro LLC",
            membershipStatus: "ACTIVE",
            serviceTypes: [],
            specializations: [],
            serviceAreas: [],
            totalEmployees: 1,
          },
        }),
      });
      return;
    }
    if (pathname === "/api/vendor/context") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, vendorId, businessName: "Electro LLC", role: "MANAGER" }),
      });
      return;
    }
    if (pathname === `/api/vendors/${vendorId}/dashboard`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: vendorId, name: "Electro LLC", businessName: "Electro LLC" },
          stats: { totalBookings: 1, totalEarnings: 0, totalClients: 1, rating: 0, ratingCount: 0 },
          recentJobs: [],
          archivedJobs: [],
          recentReviews: [],
          insights: [],
          lifecycleCounts: { scheduled: 0, inProgress: 0, awaitingReview: 0, completed: 1, canceled: 0, archived: 0 },
          notifications: read ? [] : [{
            id: notificationId,
            type: "audit",
            title: "Reliance Audit Passed",
            message: "Reliance approved the Service Video package and released Private Proof to the customer.",
            time: "2026-09-06T10:00:00.000Z",
            read: false,
            priority: "low",
            href: "/test-fixtures/rv8-vendor-notifications?opened=1",
          }],
          storageUsedBytes: "0",
          storageLimitBytes: "1",
          storagePercentUsed: 0,
        }),
      });
      return;
    }
    if (pathname === `/api/vendors/${vendorId}/notifications`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          notifications: [
            {
              id: notificationId,
              type: "audit",
              title: "Reliance Audit Passed",
              message: "Reliance approved the Service Video package and released Private Proof to the customer.",
              time: "2026-09-06T10:00:00.000Z",
              read,
              readAt: read ? "2026-09-06T10:05:00.000Z" : null,
              priority: "low",
              href: "/test-fixtures/rv8-vendor-notifications?opened=1",
              historical: false,
            },
            {
              id: "legacy-notice",
              type: "audit",
              title: "Historical Reliance Audit notice",
              message: "This accepted historical notice remains readable.",
              time: "2026-08-01T10:00:00.000Z",
              read: true,
              readAt: null,
              priority: "low",
              historical: true,
            },
          ],
        }),
      });
      return;
    }
    if (pathname === `/api/vendors/${vendorId}/notifications/${notificationId}/read`) {
      read = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, notification: { id: notificationId, readAt: "2026-09-06T10:05:00.000Z" } }),
      });
      return;
    }
    if (pathname.includes("/roles")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, availableProfiles: ["vendor"] }) });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Unmocked request" }) });
  });
}

test("Vendor dashboard audit notification is readable and clearly unread", async ({ page }) => {
  await installVendorNotificationFixture(page);
  await page.goto("/test-fixtures/rv8-vendor-dashboard");

  const title = page.getByText("Reliance Audit Passed", { exact: true });
  await expect(title).toBeVisible();
  await expect(title.locator("[aria-label='Unread']")).toBeVisible();
  const color = await title.evaluate((element) => getComputedStyle(element).color);
  expect(color).toBe("rgb(248, 251, 255)");
  await expect(page.getByRole("button", { name: "View notification history" })).toBeVisible();
});

test("Vendor notification history persists recipient read state after View details", async ({ page }) => {
  await installVendorNotificationFixture(page);
  await page.goto("/test-fixtures/rv8-vendor-notifications");

  await page.getByRole("button", { name: "Unread" }).click();
  await expect(page.getByText("Reliance Audit Passed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page).toHaveURL(/\/test-fixtures\/rv8-vendor-notifications\?opened=1$/);

  await page.getByRole("button", { name: "Unread" }).click();
  await expect(page.getByText("No unread notifications.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.getByText("Reliance Audit Passed", { exact: true })).toBeVisible();
  await expect(page.getByText("Historical Reliance Audit notice", { exact: true })).toBeVisible();
  await expect(page.getByText(/· Historical notice$/)).toBeVisible();
});
