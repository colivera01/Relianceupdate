import path from "node:path";
import { config as loadEnv } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { createAuthSessionCookie } from "../src/lib/auth-session";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

const VENDOR_ID = "rv8-replay-vendor";
const JOB_ID = "rv8-replay-job";
const MANAGER_ID = "rv8-replay-manager";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const releasedJob = {
  id: JOB_ID,
  title: "Controlled residence service",
  serviceId: "rv8-service",
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

const managerReviewJob = {
  ...releasedJob,
  id: "rv8-manager-review-job",
  title: "Controlled manager review",
  status: "AWAITING_REVIEW",
  uploadedVideoStages: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  recordingCompliance: {
    ...releasedJob.recordingCompliance,
    canonicalBlock: {
      code: "MANAGER_REVIEW_IN_PROGRESS",
      why: "The completed Service Videos were submitted for manager review.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Wait for manager review.",
      serviceMayContinue: true,
    },
  },
};

const wrongRecipientJob = {
  ...releasedJob,
  id: "rv8-wrong-recipient-job",
  title: "Wrong-recipient correction",
  consentStatus: "wrong_recipient",
  recordingCompliance: {
    ...releasedJob.recordingCompliance,
    permissionStatus: "wrong_recipient",
    consentAccepted: false,
    serviceOrderReleasedAt: null,
    releasedMembershipIds: [],
  },
};

const pendingConsentJob = {
  ...releasedJob,
  id: "rv8-pending-consent-job",
  title: "Permission status check",
  consentStatus: "pending",
  assignedEmployees: [],
  assignedMembershipIds: [],
  recordingCompliance: {
    ...releasedJob.recordingCompliance,
    permissionStatus: "pending",
    consentAccepted: false,
    serviceOrderReleasedAt: null,
    releasedMembershipIds: [],
  },
};

const permissionNotRequestedJob = {
  ...pendingConsentJob,
  id: "rv8-permission-not-requested-job",
  title: "Assignment before permission",
  latestConsentId: "",
  consentStatus: "not_requested",
  recordingCompliance: {
    ...pendingConsentJob.recordingCompliance,
    permissionStatus: "not_requested",
  },
};

const canceledJob = {
  ...releasedJob,
  id: "rv8-canceled-job",
  title: "Canceled controlled service",
  status: "CANCELED",
  cancellation: {
    status: "CANCELED",
    reason: "Customer no longer needs the service",
    canceledAt: "2026-08-15T15:30:00.000Z",
    canceledByUserId: MANAGER_ID,
  },
};

async function installVendorFixture(
  page: Page,
  jobs: any[],
  consentStatusResponse?: string | string[],
  sessionGuardResponse?: Record<string, unknown>,
) {
  let consentStatusRequestCount = 0;
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
    if (pathname === "/api/vendor/session-guard") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionGuardResponse || { ok: true, applies: true, nextCheckInMs: 60_000 }),
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
          services: [{ id: "rv8-service", name: "Controlled service", vendorId: VENDOR_ID, isPublished: true }],
        }),
      });
      return;
    }
    if (pathname === "/api/consent/status") {
      const configuredStatus = Array.isArray(consentStatusResponse)
        ? consentStatusResponse[
            Math.min(consentStatusRequestCount, consentStatusResponse.length - 1)
          ]
        : consentStatusResponse;
      consentStatusRequestCount += 1;
      const authoritativeConsentStatus = String(configuredStatus || jobs[0]?.consentStatus || "accepted");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, status: authoritativeConsentStatus }),
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
  await page.goto("/test-fixtures/rv8-vendor-jobs");
  const workflowGuide = page.getByRole("dialog", { name: "How a work record becomes customer-visible proof" });
  const guideOpened = await workflowGuide
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (guideOpened) {
    await workflowGuide.getByRole("button", { name: "Got it" }).click();
  }
}

test.describe("RV-8 Product Owner replay corrections", () => {
  test.describe.configure({ mode: "serial" });

  test("uses plain-language mutually exclusive recording-scope questions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorFixture(page, []);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Add Work Record" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Work Record" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Whose property may appear in the video?" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Could anyone be identifiable in the video?" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "What will the camera primarily show?" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /Who can approve recording for this service\?/ })).toHaveCount(0);
    await expect(dialog.getByText("Customer's authorized representative", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Parent or legal guardian", { exact: true })).toHaveCount(0);

    await expect(dialog.getByText("Is recording required to complete this service?")).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: /Recording is required/ })).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: /service can continue without recording/ })).toHaveCount(0);

  });

  test("shows the authoritative no-match outcome beside manual address creation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorFixture(page, []);
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "CUSTOMER_RESIDENCE_ADDRESS_UNVERIFIED",
          error: "We could not verify this address. Check the address or choose the correct suggested location.",
        }),
      });
    });
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Add Work Record" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Work Record" });
    await dialog.locator("select").first().selectOption("rv8-service");
    await dialog.getByPlaceholder("First name").fill("Reliance");
    await dialog.getByPlaceholder("Last name").fill("Customer");
    await dialog.getByPlaceholder("Enter email address").fill("customer@example.test");
    await dialog.getByRole("radio", { name: /Customer residence/ }).check();
    await dialog.getByPlaceholder("Start typing the service street address").fill("888 City Walk Ln");
    await dialog.getByPlaceholder("City").fill("Oviedo");
    await dialog.getByPlaceholder("State").fill("FL");
    await dialog.getByPlaceholder("ZIP code").fill("32765");
    await dialog.getByRole("combobox", { name: "Whose property may appear in the video?" }).selectOption("customer_owned");
    await dialog.getByRole("combobox", { name: "Could anyone be identifiable in the video?" }).selectOption("none");
    await dialog.getByRole("combobox", { name: "What will the camera primarily show?" }).selectOption("controlled");
    await dialog.getByRole("button", { name: "Add Work Record" }).click();

    await expect(dialog.getByText("We could not verify this address. Check the address or choose the correct suggested location.")).toBeVisible();
  });

  test("shows released work as read-only and keeps evidence and cancellation in Actions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installVendorFixture(page, [releasedJob]);
    await openVendorJobs(page);

    await expect(page.getByText(releasedJob.title, { exact: true })).toBeVisible();
    const progress = page.getByLabel("Work record progress");
    await expect(progress).toHaveCount(1);
    await expect(progress).toContainText("Service Order Sent");
    await expect(page.getByText("Service Order Sent", { exact: true })).toHaveCount(1);
    await expect(page.getByLabel("Service Order status")).toHaveCount(0);
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
    await evidenceDialog.getByRole("button", { name: "Close" }).first().click();

    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("button", { name: "Cancel Service Order" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel Service Order" });
    await expect(cancelDialog).toContainText("Existing permission, location, assignment, delivery, and audit evidence will remain");
    await expect(cancelDialog.getByLabel("Cancellation reason")).toBeVisible();
  });

  test("keeps Manager Review controls in one place and Actions separate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorFixture(page, [managerReviewJob]);
    await openVendorJobs(page);

    const progress = page.getByLabel("Work record progress");
    await expect(progress).toContainText("Awaiting Manager Review");
    await expect(page.getByRole("button", { name: "Approve Private Proof" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Request Changes" })).toHaveCount(1);

    await page.getByRole("button", { name: "Actions" }).click();
    const actionsMenu = page.getByRole("menu");
    await expect(actionsMenu.getByRole("button", { name: "View Details" })).toBeVisible();
    await expect(actionsMenu.getByRole("button", { name: "Approve Private Proof" })).toHaveCount(0);
    await expect(actionsMenu.getByRole("button", { name: "Request Changes" })).toHaveCount(0);
  });

  test("requires recipient correction and does not offer ordinary resend after a wrong-recipient report", async ({ page }) => {
    await installVendorFixture(page, [wrongRecipientJob]);
    await openVendorJobs(page);

    await expect(page.getByText("Recording request reported as wrong recipient", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Correct Customer Contact" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage Recording Permission" });
    await expect(dialog).toContainText("reported this request as misdirected");
    await expect(dialog.getByRole("button", { name: "Resend Permission Request" })).toHaveCount(0);
    await expect(dialog).toContainText("Resending to the current recipient is disabled");
    await expect(dialog.getByRole("button", { name: "Correct Recipient and Send New Request" })).toBeVisible();
  });

  test("Refresh Permission Status updates only the affected card and does not invoke employee release", async ({ page }) => {
    const actionRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/actions")) actionRequests.push(request.url());
    });
    await installVendorFixture(page, [pendingConsentJob], ["pending", "accepted"]);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Refresh Permission Status" }).click();
    await expect(page.getByRole("status")).toHaveText("Customer permission approved.");
    expect(actionRequests).toEqual([]);
    await expect(page.getByText(/Assign this job before sending/i)).toHaveCount(0);
  });

  test("allows scheduling assignment while explaining that release and recording remain gated", async ({ page }) => {
    await installVendorFixture(page, [permissionNotRequestedJob]);
    await openVendorJobs(page);

    const progress = page.getByLabel("Work record progress");
    await expect(progress).toContainText("You may assign an employee for scheduling");
    await expect(progress).toContainText("Service Order release and recording remain locked");
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("button", { name: "Assign Employee" })).toBeVisible();
  });

  test("keeps canceled records in All but excludes them from Active Work", async ({ page }) => {
    await installVendorFixture(page, [canceledJob]);
    await openVendorJobs(page);

    await expect(page.getByText(canceledJob.title, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Work record progress")).toContainText("Service Order canceled");
    await expect(page.getByLabel("Work record progress")).toContainText("permanently closed");
    await page.getByRole("button", { name: /Active Work/ }).click();
    await expect(page.getByText(canceledJob.title, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Canceled/ }).click();
    await expect(page.getByText(canceledJob.title, { exact: true })).toBeVisible();
  });

  test("warns before a material edit and canceling the warning performs no mutation", async ({ page }) => {
    const mutationRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/actions")) {
        mutationRequests.push(request.url());
      }
    });
    await installVendorFixture(page, [pendingConsentJob]);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Work Record" });
    await editDialog.getByRole("combobox", { name: "Could anyone be identifiable in the video?" }).selectOption("customer");
    await editDialog.getByRole("button", { name: "Save Work" }).click();

    const warning = page.getByRole("dialog", { name: "Request new recording permission?" });
    await expect(warning).toContainText("Prior permission and certification evidence will remain preserved");
    await warning.getByRole("button", { name: "Go Back" }).click();
    expect(mutationRequests).toEqual([]);
    await expect(editDialog).toBeVisible();
  });

  test("warns before vendor inactivity expiry and offers secure renewal", async ({ page }) => {
    const now = Date.now();
    await installVendorFixture(page, [], undefined, {
      ok: true,
      applies: true,
      timeoutMinutes: 30,
      idleExpiresAt: new Date(now + 90_000).toISOString(),
      absoluteExpiresAt: new Date(now + 24 * 60 * 60_000).toISOString(),
      warningAt: new Date(now - 1_000).toISOString(),
      nextCheckInMs: 15_000,
    });
    await openVendorJobs(page);

    const warning = page.getByRole("alertdialog", { name: "You will be signed out due to inactivity" });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Stay signed in to continue working");
    await warning.getByRole("button", { name: "Stay signed in" }).click();
    await expect(warning).toBeHidden();
  });

  test("closes the edit modal without rendering undefined create-only address values", async ({ page }) => {
    await installVendorFixture(page, [pendingConsentJob]);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Work Record" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("First name")).toBeDisabled();
    await expect(dialog.getByPlaceholder("Enter email address")).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: /Customer residence/ })).toBeDisabled();
    await expect(dialog).toContainText("Manage Recording Permission");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByText(pendingConsentJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText(/Cannot read properties of undefined/i)).toHaveCount(0);
  });
});
