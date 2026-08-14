import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { createAuthSessionCookie } from "../src/lib/auth-session";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

const VENDOR_ID = "rv8-replay-vendor";
const JOB_ID = "rv8-replay-job";
const MANAGER_ID = "rv8-replay-manager";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const prisma = new PrismaClient();

const releasedJob = {
  id: JOB_ID,
  title: "Controlled residence service",
  client: "Controlled Customer",
  clientName: "Controlled Customer",
  customerEmail: "c***@example.test",
  customerPhone: "***-***-0199",
  status: "PENDING",
  assignedEmployees: ["Controlled Employee"],
  assignedMembershipIds: ["rv8-employee-membership"],
  latestConsentId: "rv8-permission-1",
  consentStatus: "accepted",
  recordingCompliance: {
    location: "residence",
    permissionRequired: true,
    permissionStatus: "allowed",
    consentAccepted: true,
    consentRequestId: "rv8-permission-1",
    recordingUnlocked: false,
    serviceOrderReleasedAt: "2026-08-13T15:00:00.000Z",
    releasedMembershipIds: ["rv8-employee-membership"],
    canonicalBlock: {
      code: "LOCATION_VERIFICATION_REQUIRED",
      why: "The employee device has not verified the saved service location.",
      responsibleParticipant: "EMPLOYEE",
      resolution: "Allow precise location and verify the saved service address.",
      serviceMayContinue: true,
    },
  },
  createdAt: "2026-08-13T14:00:00.000Z",
  updatedAt: "2026-08-13T15:00:00.000Z",
};

async function installVendorFixture(page: Page, jobs: unknown[]) {
  const session = createAuthSessionCookie({
    userId: MANAGER_ID,
    email: "manager@reliance.test",
    userType: "vendor",
    availableProfiles: ["vendor"],
  });
  await page.context().addCookies([
    {
      name: "reliance_session",
      value: session,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "userData",
      JSON.stringify({
        id: "rv8-manager",
        name: "Controlled Manager",
        email: "manager@reliance.test",
        userType: "vendor",
        availableProfiles: ["vendor"],
      }),
    );
  });

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
            id: "rv8-manager",
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
            name: "Controlled Services",
            businessName: "Controlled Services",
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
        body: JSON.stringify({ success: true, vendorId: VENDOR_ID, businessName: "Controlled Services" }),
      });
      return;
    }
    if (pathname === `/api/vendors/${VENDOR_ID}/dashboard`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recentJobs: jobs, archivedJobs: [] }),
      });
      return;
    }
    if (pathname === `/api/vendors/${VENDOR_ID}/memberships`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          memberships: [
            {
              id: "rv8-employee-membership",
              membershipId: "rv8-employee-membership",
              role: "EMPLOYEE",
              status: "ACTIVE",
              user: { id: "rv8-employee", name: "Controlled Employee", email: "employee@reliance.test" },
            },
          ],
        }),
      });
      return;
    }
    if (pathname === "/api/services") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          services: [{ id: "rv8-service", name: "Controlled service", status: "APPROVED" }],
        }),
      });
      return;
    }
    if (pathname === `/api/vendors/${VENDOR_ID}/jobs/${JOB_ID}/recording-permission`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          readOnly: true,
          permission: {
            id: "rv8-permission-1",
            lifecycleStatus: "accepted",
            verifiedDecision: true,
            recipient: { name: "Controlled Customer", email: "c***@example.test", phone: null },
            audioEnabled: false,
            decisionEvidence: {
              id: "rv8-decision-evidence-1",
              decision: "allowed",
              claimedRole: "customer",
              verificationMethod: "email_otp",
              decidedAt: "2026-08-13T14:45:00.000Z",
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
}

async function openVendorJobs(page: Page) {
  await page.goto("/vendor/jobs");
  const workflowGuide = page.getByRole("dialog", { name: "How a work record becomes customer-visible proof" });
  if (await workflowGuide.isVisible().catch(() => false)) {
    await workflowGuide.getByRole("button", { name: "Got it" }).click();
  }
}

test.describe("RV-8 Product Owner replay corrections", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: MANAGER_ID },
      create: {
        id: MANAGER_ID,
        name: "Controlled Manager",
        email: "manager@reliance.test",
        accountStatus: "active",
        demo: true,
      },
      update: { name: "Controlled Manager", accountStatus: "active" },
    });
    await prisma.vendor.upsert({
      where: { id: VENDOR_ID },
      create: {
        id: VENDOR_ID,
        name: "Controlled Services",
        businessName: "Controlled Services",
        email: "rv8-replay-vendor@reliance.test",
        accountStatus: "active",
        demo: true,
      },
      update: { accountStatus: "active" },
    });
    await prisma.vendorMembership.upsert({
      where: { vendorId_userId: { vendorId: VENDOR_ID, userId: MANAGER_ID } },
      create: {
        id: "rv8-replay-manager-membership",
        vendorId: VENDOR_ID,
        userId: MANAGER_ID,
        role: "MANAGER",
        status: "ACTIVE",
        approvedAt: new Date(),
      },
      update: { role: "MANAGER", status: "ACTIVE", revokedAt: null },
    });
  });

  test.afterAll(async () => {
    await prisma.vendorMembership.deleteMany({ where: { vendorId: VENDOR_ID } });
    await prisma.vendor.deleteMany({ where: { id: VENDOR_ID } });
    await prisma.user.deleteMany({ where: { id: MANAGER_ID } });
    await prisma.$disconnect();
  });

  test("uses plain-language mutually exclusive recording-scope questions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorFixture(page, []);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Add Work Record" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Work Record" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Whose property may appear in the video?", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Could anyone be identifiable in the video?", { exact: true })).toBeVisible();
    await expect(dialog.getByText("What will the camera primarily show?", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Who can approve recording for this service?", { exact: true })).toBeVisible();

    const required = dialog.getByRole("radio", { name: /Yes - Recording is required/ });
    const optional = dialog.getByRole("radio", { name: /No - The service can continue without recording/ });
    await optional.check();
    await expect(optional).toBeChecked();
    await expect(required).not.toBeChecked();
    await required.check();
    await expect(required).toBeChecked();
    await expect(optional).not.toBeChecked();

    const authority = dialog.getByText("Who can approve recording for this service?", { exact: true }).locator("select");
    await expect(authority.locator("option")).toHaveText([
      "Choose one",
      "Customer",
      "Customer's authorized representative",
      "Parent or legal guardian",
      "Vendor manager",
    ]);
  });

  test("shows released work as read-only and keeps evidence and cancellation in Actions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installVendorFixture(page, [releasedJob]);
    await openVendorJobs(page);

    await expect(page.getByText(releasedJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText("Service Order Sent", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Starting Condition" })).toHaveCount(0);

    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("button", { name: "View Recording Permission" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend Service Order Link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Service Order" })).toBeVisible();

    await page.getByRole("button", { name: "View Recording Permission" }).click();
    const evidenceDialog = page.getByRole("dialog", { name: "Recording Permission" });
    await expect(evidenceDialog).toContainText("read-only evidence");
    await expect(evidenceDialog).toContainText("Recording allowed");
    await expect(evidenceDialog).toContainText("rv8-decision-evidence-1");
    await evidenceDialog.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("button", { name: "Cancel Service Order" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel Service Order" });
    await expect(cancelDialog).toContainText("Existing permission, location, assignment, delivery, and audit evidence will remain");
    await expect(cancelDialog.getByLabel("Cancellation reason")).toBeVisible();
  });
});
