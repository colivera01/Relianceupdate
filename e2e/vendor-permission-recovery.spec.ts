import path from "path";

import { expect, test, type Page } from "@playwright/test";

const VENDOR_ID = "controlled-recovery-vendor";
const JOB_ID = "controlled-recovery-job";
const REQUEST_ID = "controlled-permission-request";
const SCREENSHOT_ROOT = path.join(
  process.cwd(),
  "output",
  "epic1-screenshot-package",
  "After"
);

async function installVendorRecoveryFixture(page: Page) {
  let resendCount = 0;
  let correctionBody: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "userData",
      JSON.stringify({
        id: "controlled-manager",
        name: "Controlled Manager",
        email: "manager@reliance.test",
        userType: "vendor",
        availableProfiles: ["vendor"],
      })
    );
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "controlled-manager",
            name: "Controlled Manager",
            email: "manager@reliance.test",
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
            id: VENDOR_ID,
            name: "Controlled Home Services",
            businessName: "Controlled Home Services",
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
        body: JSON.stringify({ success: true, vendorId: VENDOR_ID, businessName: "Controlled Home Services" }),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/dashboard`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recentJobs: [
            {
              id: JOB_ID,
              title: "Controlled residence service",
              client: "Casey Customer",
              customerEmail: "casey.customer@example.test",
              customerPhone: "4075550199",
              status: "PENDING",
              assignedEmployees: ["Controlled Employee"],
              assignedMembershipIds: ["controlled-membership"],
              consentStatus: "wrong_recipient",
              latestConsentId: REQUEST_ID,
              recordingCompliance: {
                location: "residence",
                permissionRequired: true,
                permissionStatus: "wrong_recipient",
                recordingUnlocked: false,
                consentRequestId: REQUEST_ID,
              },
              createdAt: "2026-08-02T12:00:00.000Z",
              updatedAt: "2026-08-02T12:00:00.000Z",
            },
          ],
          archivedJobs: [],
        }),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/memberships`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ memberships: [] }) });
      return;
    }

    if (pathname === "/api/services") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) });
      return;
    }

    if (pathname === "/api/consent/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          status: "wrong_recipient",
          permission: { id: REQUEST_ID, state: "wrong_recipient" },
          latestConsentId: REQUEST_ID,
        }),
      });
      return;
    }

    if (pathname === `/api/consent/requests/${REQUEST_ID}/resend` && request.method() === "POST") {
      resendCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          permission: {
            id: REQUEST_ID,
            state: "delivered",
            recipient: { email: "c********@example.test", phone: "***-***-0199" },
          },
        }),
      });
      return;
    }

    if (pathname === `/api/consent/requests/${REQUEST_ID}/recipient` && request.method() === "PATCH") {
      correctionBody = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          permission: {
            id: "controlled-permission-corrected",
            state: "delivered",
            recipient: { email: "n**@example.test", phone: null },
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  return {
    getResendCount: () => resendCount,
    getCorrectionBody: () => correctionBody,
  };
}

async function openRecovery(page: Page) {
  await page.goto("/vendor/jobs");
  await expect(page.getByText("Controlled residence service", { exact: true })).toBeVisible();
  const workflowGuide = page.getByRole("dialog", { name: "How a work record becomes customer-visible proof" });
  if (await workflowGuide.isVisible().catch(() => false)) {
    await workflowGuide.getByRole("button", { name: "Got it" }).click();
  }
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Manage Recording Permission" }).click();
  await expect(page.getByRole("heading", { name: "Manage Recording Permission" })).toBeVisible();
  await expect(page.getByText("c********@example.test / ***-***-0199")).toBeVisible();
  await expect(page.getByText(/Recording remains locked/)).toBeVisible();
}

test.describe("vendor permission recovery", () => {
  test("resends securely and corrects the recipient on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await installVendorRecoveryFixture(page);
    await openRecovery(page);

    await page.getByRole("button", { name: "Resend Permission Request" }).click();
    await expect.poll(fixture.getResendCount).toBe(1);
    await expect(page.getByRole("status")).toContainText("previous link no longer works");

    await page.getByLabel("Customer or authorized representative").fill("New Recipient");
    await page.getByLabel("Email").fill("new.recipient@example.test");
    await page.getByLabel("Mobile phone").fill("");
    await page.getByRole("button", { name: "Correct Recipient and Send New Request" }).click();
    await expect.poll(fixture.getCorrectionBody).toEqual({
      name: "New Recipient",
      email: "new.recipient@example.test",
      phone: null,
    });
    await expect(page.getByRole("status")).toContainText("corrected recipient");

    await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
    await page.screenshot({
      path: path.join(SCREENSHOT_ROOT, "desktop-permission-recovery-success.png"),
      fullPage: true,
    });
  });

  test("keeps permission recovery usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorRecoveryFixture(page);
    await openRecovery(page);
    await expect(page.getByRole("button", { name: "Resend Permission Request" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Correct Recipient and Send New Request" })).toBeVisible();

    await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
    await page.screenshot({
      path: path.join(SCREENSHOT_ROOT, "mobile-permission-recovery.png"),
      fullPage: true,
    });
  });
});
