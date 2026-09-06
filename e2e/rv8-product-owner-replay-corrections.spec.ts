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

const passedAuditJob = {
  ...releasedJob,
  id: "rv8-admin-pass-job",
  title: "Admin passed Private Proof",
  status: "COMPLETED",
  operationalPhase: "COMPLETED",
  uploadedVideoStages: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  serviceVideoPackage: {
    id: "rv8-package-pass",
    version: 1,
    status: "PRIVATE_APPROVED",
  },
  adminAuditDecision: {
    decision: "PASS",
    decidedAt: "2026-08-16T16:00:00.000Z",
    packageVersion: 1,
  },
};

const rejectedAuditJob = {
  ...passedAuditJob,
  id: "rv8-admin-reject-job",
  title: "Admin rejected package",
  status: "REJECTED",
  operationalPhase: "REJECTED",
  serviceVideoPackage: {
    id: "rv8-package-reject",
    version: 1,
    status: "ADMIN_REJECTED",
  },
  adminAuditDecision: {
    decision: "REJECT",
    rejectionCategory: "PRIVACY_OR_SCOPE",
    reason: "Recording exceeded the approved scope.",
    decidedAt: "2026-08-16T16:00:00.000Z",
    packageVersion: 1,
  },
};

const genericCompletedJob = {
  ...passedAuditJob,
  id: "rv8-generic-completed-job",
  title: "Generic completed work",
  serviceVideoPackage: null,
  adminAuditDecision: null,
};

const pendingAdminAuditJob = {
  ...passedAuditJob,
  id: "rv8-admin-pending-job",
  title: "Pending Reliance Audit",
  operationalPhase: "AWAITING_ADMIN_REVIEW",
  serviceVideoPackage: {
    id: "rv8-package-pending",
    version: 1,
    status: "AWAITING_ADMIN_REVIEW",
  },
  adminAuditDecision: null,
};

async function installVendorFixture(
  page: Page,
  jobs: any[],
  consentStatusResponse?: string | string[],
  sessionGuardResponse?: Record<string, unknown>,
  identity: { userId: string; role: "MANAGER" | "EMPLOYEE"; name: string; email: string } = {
    userId: MANAGER_ID,
    role: "MANAGER",
    name: "Controlled Manager",
    email: "manager@reliance.test",
  },
) {
  let consentStatusRequestCount = 0;
  let consentStatusOverride: string | null = null;
  const session = createAuthSessionCookie({
    userId: identity.userId,
    email: identity.email,
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
        id: identity.userId,
        name: identity.name,
        email: identity.email,
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
            id: identity.userId,
            name: identity.name,
            email: identity.email,
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
        body: JSON.stringify({ success: true, vendorId: VENDOR_ID, businessName: "Controlled Services", role: identity.role }),
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
      const authoritativeConsentStatus = String(
        consentStatusOverride || configuredStatus || jobs[0]?.consentStatus || "accepted"
      );
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

  return {
    setConsentStatus(status: string) {
      consentStatusOverride = status;
    },
  };
}

async function openVendorJobs(page: Page) {
  await page.goto("/test-fixtures/rv8-vendor-jobs");
  const workflowGuide = page.getByRole("dialog", { name: "How a work record becomes customer-visible proof" });
  const guideOpened = await workflowGuide
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (guideOpened) {
    await workflowGuide
      .getByRole("button", { name: "Got it" })
      .click({ timeout: 5_000 })
      .catch(() => undefined);
  }
}

test.describe("RV-8 Product Owner replay corrections", () => {
  test.describe.configure({ mode: "serial" });

  test("uses Reliance Audit terminology and requires explicit PASS and terminal REJECT confirmation", async ({ page }) => {
    let decisionRequests = 0;
    let passRequest: Record<string, unknown> | null = null;
    await page.route("**/api/admin/media/packages/audit-booking-1/moderate", async (route) => {
      decisionRequests += 1;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (String(body.action).toUpperCase() === "PASS") passRequest = body;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Audit decision recorded" }),
      });
    });

    await page.goto("/test-fixtures/rv8-admin-audit");
    await expect(page.getByRole("heading", { name: "Reliance Audit", exact: true })).toBeVisible();
    await expect(page.getByText("Submitted by: Electro LLC Manager")).toBeVisible();
    await expect(page.getByText("Exact package version: 3")).toBeVisible();
    await expect(page.getByText("Advanced stage controls")).toHaveCount(0);

    await page.getByRole("button", { name: "PASS Audit" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm Reliance Audit PASS" })).toBeVisible();
    expect(decisionRequests).toBe(0);
    await page.getByRole("button", { name: "Confirm PASS and Release Private Proof" }).click();
    expect(decisionRequests).toBe(1);
    expect(passRequest).toMatchObject({
      action: "pass",
      publicDisplayEligibility: "PUBLIC_DISPLAY_ELIGIBLE",
    });

    await page.reload();
    await page.getByRole("button", { name: "REJECT Audit" }).click();
    const reasonDialog = page.getByRole("dialog", { name: "Reject Package" });
    await reasonDialog.getByLabel("Rejection category").selectOption("PRIVACY_OR_SCOPE");
    await reasonDialog.getByPlaceholder("Enter package rejection reason...").fill("Recording exceeded the approved scope.");
    await reasonDialog.getByRole("button", { name: "Continue to terminal confirmation" }).click();
    expect(decisionRequests).toBe(1);
    const terminalDialog = page.getByRole("dialog", { name: "Confirm terminal Reliance Audit REJECT" });
    await expect(terminalDialog.getByText("permanently closes the Reliance work record")).toBeVisible();
    await expect(terminalDialog.getByText("Privacy or recording scope", { exact: false })).toBeVisible();
    await terminalDialog.getByRole("button", { name: "Confirm Terminal REJECT" }).click();
    expect(decisionRequests).toBe(2);
  });

  test("records a Private Proof-only outcome within the single Reliance Audit", async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null;
    await page.route("**/api/admin/media/packages/audit-booking-1/moderate", async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Audit decision recorded" }),
      });
    });

    await page.goto("/test-fixtures/rv8-admin-audit");
    await page.getByRole("button", { name: "PASS Audit" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm Reliance Audit PASS" });
    await dialog.getByLabel("Private Proof only").check();
    await dialog.getByLabel("Private-only explanation").fill(
      "Customer-visible evidence contains details unsuitable for Public display.",
    );
    await dialog.getByRole("button", { name: "Confirm PASS and Release Private Proof" }).click();

    expect(requestBody).toMatchObject({
      action: "pass",
      publicDisplayEligibility: "PRIVATE_ONLY",
      publicDisplayReason:
        "Customer-visible evidence contains details unsuitable for Public display.",
    });
  });

  test("uses the simplified work-record recording-scope contract", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorFixture(page, []);
    await openVendorJobs(page);

    await page.getByRole("button", { name: "Add Work Record" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Work Record" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Who, if anyone, needs to be intentionally identifiable in the Service Video?" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Whose property may appear in the video?" })).toHaveCount(0);
    await expect(dialog.getByRole("combobox", { name: "Could anyone be identifiable in the video?" })).toHaveCount(0);
    await expect(dialog.getByRole("combobox", { name: "What will the camera primarily show?" })).toHaveCount(0);
    await expect(dialog.getByText("The video is limited to the service area, equipment or item, and the work being performed.", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Keep prohibited content out of the recording", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Do not record minors, unrelated bystanders or conversations", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Does this Service Video need audio?", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /No - Video only/ })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: /Yes - Video and audio/ })).not.toBeChecked();
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
    await dialog.getByRole("combobox", { name: "Who, if anyone, needs to be intentionally identifiable in the Service Video?" }).selectOption("none");
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
    await expect(page.getByRole("button", { name: "Submit to Reliance Audit" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Request Changes" })).toHaveCount(1);

    await page.getByRole("button", { name: "Actions" }).click();
    const actionsMenu = page.getByRole("menu");
    await expect(actionsMenu.getByRole("button", { name: "View Details" })).toBeVisible();
    await expect(actionsMenu.getByRole("button", { name: "Privacy & Governance" })).toHaveCount(0);
    await expect(actionsMenu.getByRole("button", { name: "Submit to Reliance Audit" })).toHaveCount(0);
    await expect(actionsMenu.getByRole("button", { name: "Request Changes" })).toHaveCount(0);
  });

  test("renders canonical Admin PASS and requires approved evidence for the Private Proof filter", async ({ page }) => {
    await installVendorFixture(page, [passedAuditJob, genericCompletedJob]);
    await openVendorJobs(page);

    const passedCard = page.getByTestId(`vendor-job-card-${passedAuditJob.id}`);
    await expect(passedCard.getByLabel("Work record progress")).toContainText("Reliance Audit Passed");
    await expect(passedCard.getByLabel("Work record progress")).toContainText("No participant needs to act");
    await expect(passedCard.getByLabel("Work record progress")).toContainText("read-only evidence");
    await passedCard.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menu").getByRole("button", { name: "View Details" })).toBeVisible();
    await expect(page.getByRole("menu").getByRole("button", { name: "Archive Job" })).toHaveCount(0);

    await page.getByRole("button", { name: /Private Proof/ }).click();
    await expect(page.getByText(passedAuditJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText(genericCompletedJob.title, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /Active Work/ }).click();
    await expect(page.getByText(genericCompletedJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText(passedAuditJob.title, { exact: true })).toHaveCount(0);
  });

  test("renders terminal Admin REJECT without exposing Archive Job", async ({ page }) => {
    await installVendorFixture(page, [rejectedAuditJob]);
    await openVendorJobs(page);

    const rejectedCard = page.getByTestId(`vendor-job-card-${rejectedAuditJob.id}`);
    await expect(rejectedCard.getByLabel("Work record progress")).toContainText("Reliance Audit Failed");
    await expect(rejectedCard.getByLabel("Work record progress")).toContainText("No participant needs to act");
    await rejectedCard.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menu").getByRole("button", { name: "View Details" })).toBeVisible();
    await expect(page.getByRole("menu").getByRole("button", { name: "Archive Job" })).toHaveCount(0);
  });

  test("keeps only an actionable package in the Reliance Audit filter", async ({ page }) => {
    await installVendorFixture(page, [pendingAdminAuditJob, passedAuditJob, rejectedAuditJob]);
    await openVendorJobs(page);

    await page.getByRole("button", { name: /Reliance Audit/ }).click();
    await expect(page.getByText(pendingAdminAuditJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText(passedAuditJob.title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(rejectedAuditJob.title, { exact: true })).toHaveCount(0);
  });

  test("does not expose the manager governance entry to an Employee", async ({ page }) => {
    await installVendorFixture(page, [managerReviewJob], undefined, undefined, {
      userId: "rv8-employee",
      role: "EMPLOYEE",
      name: "Controlled Employee",
      email: "employee@reliance.test",
    });

    await openVendorJobs(page);

    await expect(page.getByRole("heading", { name: "My Assigned Work" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Privacy & Governance" })).toHaveCount(0);
  });

  test("retired Vendor Manager governance route is unavailable", async ({ page }) => {
    await installVendorFixture(page, [managerReviewJob]);
    const response = await page.goto(`/vendor/jobs/${managerReviewJob.id}/privacy-governance`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Privacy & Governance", { exact: true })).toHaveCount(0);
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
    const fixture = await installVendorFixture(page, [pendingConsentJob], "pending");
    await openVendorJobs(page);

    fixture.setConsentStatus("accepted");
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
    await editDialog
      .getByRole("combobox", { name: "Who, if anyone, needs to be intentionally identifiable in the Service Video?" })
      .selectOption("customer");
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
