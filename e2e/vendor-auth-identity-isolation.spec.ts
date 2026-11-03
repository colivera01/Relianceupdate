import { expect, test, type Page, type Route } from "@playwright/test";

const VENDOR_ID = "actor-isolation-vendor";
const JOB_ID = "actor-isolation-job";
const SESSION_ID = "actor-isolation-session";
const ASSET_ID = "actor-isolation-asset";
const SENSITIVE_TITLE = "Manager Review Test Service";
const SENSITIVE_CUSTOMER = "Phase A Customer";

type Actor = "manager" | "customer";

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function gotoWithCompileRetry(page: Page, url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && /ERR_ABORTED|frame was detached/i.test(String(error))) continue;
      throw error;
    }
  }
  throw lastError;
}

async function installIdentitySwitchFixture(page: Page) {
  let actor: Actor = "manager";
  let customerProfileRequested = false;
  let lateDownloadRequested = false;
  let releaseCustomerProfile!: () => void;
  let releaseLateDownload!: () => void;
  const customerProfileGate = new Promise<void>((resolve) => {
    releaseCustomerProfile = resolve;
  });
  const lateDownloadGate = new Promise<void>((resolve) => {
    releaseLateDownload = resolve;
  });

  const manager = {
    id: "actor-isolation-manager",
    name: "Morgan Manager",
    email: "manager@actor-isolation.test",
    userType: "vendor",
    availableProfiles: ["vendor"],
  };
  const customer = {
    id: "actor-isolation-customer",
    name: "Casey Customer",
    email: "customer@actor-isolation.test",
    userType: "customer",
    availableProfiles: ["customer"],
  };

  await page.addInitScript(({ user }) => {
    sessionStorage.setItem("userData", JSON.stringify(user));
    sessionStorage.setItem("authToken", "manager-session-token");
  }, { user: manager });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/auth/session") {
      const user = actor === "manager" ? manager : customer;
      await json(route, 200, {
        authenticated: true,
        user,
        token: actor === "manager" ? "manager-session-token" : "customer-session-token",
      });
      return;
    }

    if (pathname === "/api/vendor/profile") {
      if (actor === "customer") {
        customerProfileRequested = true;
        await customerProfileGate;
        await json(route, 403, {
          success: false,
          code: "VENDOR_ACCESS_REQUIRED",
          error: "Vendor access required.",
        });
        return;
      }
      await json(route, 200, {
        success: true,
        profile: {
          id: VENDOR_ID,
          name: "Phase A Test Services",
          businessName: "Phase A Test Services",
          membershipStatus: "ACTIVE",
          serviceTypes: [],
          specializations: [],
          serviceAreas: [],
          totalEmployees: 1,
        },
      });
      return;
    }

    if (pathname === "/api/vendor/context") {
      if (actor === "customer") {
        await json(route, 403, { success: false, error: "Vendor access required." });
        return;
      }
      await json(route, 200, {
        success: true,
        vendorId: VENDOR_ID,
        businessName: "Phase A Test Services",
        role: "MANAGER",
      });
      return;
    }

    if (pathname === "/api/vendor/legal-assent") {
      await json(route, 200, {
        success: true,
        identity: {
          vendorId: VENDOR_ID,
          vendorName: "Phase A Test Services",
          actorRole: "MANAGER",
          membershipId: "actor-isolation-membership",
        },
        status: { current: true, decision: "ASSENT", decidedAt: "2026-08-17T09:00:00.000Z" },
        presentation: {
          packageKey: "vendor-manager-current",
          contentSetHash: "actor-isolation-role-content",
          content: [],
          vendorAcknowledgements: [],
        },
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/jobs/${JOB_ID}`) {
      await json(route, 200, {
        success: true,
        job: {
          id: JOB_ID,
          title: SENSITIVE_TITLE,
          client: SENSITIVE_CUSTOMER,
          customerEmail: "phase-a-customer@example.test",
          customerPhone: "4075550130",
          status: "AWAITING_REVIEW",
          source: "vendor_created",
          assignedEmployees: ["Sensitive Assigned Employee"],
          recordingAssessment: {
            id: "actor-isolation-assessment",
            generation: 1,
            locationType: "residence",
            siteControl: "customer_controlled",
            intentionalParticipantPlan: "customer_and_assigned_professional",
            permissionRequired: true,
            scopeHash: "actor-isolation-scope",
            audioAllowed: false,
          },
          recordingCompliance: {
            location: "residence",
            permissionRequired: true,
            permissionStatus: "ALLOWED",
            serviceOrderCurrent: false,
            serviceOrderAnyReleased: false,
            managerAttestationRequiredForRelease: true,
            audioAllowed: false,
            employeeParticipation: {
              required: true,
              complete: true,
              status: "ALLOWED",
              requiredMembershipIds: ["actor-isolation-membership"],
              missingMembershipIds: [],
              declinedMembershipIds: [],
              staleMembershipIds: [],
              inactiveMembershipIds: [],
            },
          },
        },
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/sessions`) {
      await json(route, 200, {
        success: true,
        sessions: [{ id: SESSION_ID, vendorJobVideoStage: "INTRO" }],
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/sessions/${SESSION_ID}`) {
      await json(route, 200, {
        success: true,
        session: {
          id: SESSION_ID,
          vendorJobVideoStage: "INTRO",
          createdAt: "2026-08-17T10:00:00.000Z",
          mediaAssets: [{
            id: ASSET_ID,
            createdAt: "2026-08-17T10:00:00.000Z",
            uploadState: "SAVED",
            audioExpected: false,
            audioPresence: "ABSENT",
          }],
        },
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/${ASSET_ID}/download`) {
      lateDownloadRequested = true;
      await lateDownloadGate;
      await json(route, 200, {
        success: true,
        downloadUrl: "https://actorisolation.blob.core.windows.net/private/starting-condition.webm",
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/jobs/${JOB_ID}/manager-attestation`) {
      if (actor === "customer") {
        await json(route, 403, { success: false, error: "Vendor access required." });
        return;
      }
      await json(route, 200, {
        success: true,
        status: { current: false, decidedAt: null },
        contextHash: "actor-isolation-context-hash",
        contentSetHash: "actor-isolation-content-set-hash",
        presentation: {
          title: "Manager Work Record attestation",
          attestationText: "Confirm the current assignment and recording scope.",
          confirmationText: "I confirm the current Work Record.",
          disclaimerText: "This confirmation does not authorize Public use.",
          actionLabel: "Confirm Work Record attestation",
        },
        context: {
          assignmentGeneration: 1,
          assignedMembershipIds: ["actor-isolation-membership"],
          assessmentGeneration: 1,
          scopeHash: "actor-isolation-scope",
        },
      });
      return;
    }

    if (pathname.includes("/roles")) {
      await json(route, 200, {
        success: true,
        availableProfiles: actor === "manager" ? ["vendor"] : ["customer"],
      });
      return;
    }

    await json(route, 200, { success: true });
  });

  return {
    switchToCustomer: async () => {
      actor = "customer";
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    },
    customerProfileRequested: () => customerProfileRequested,
    lateDownloadRequested: () => lateDownloadRequested,
    releaseCustomerProfile,
    releaseLateDownload,
  };
}

test("same-route manager-to-customer reconciliation purges protected vendor UI and ignores a late media response", async ({ page }) => {
  test.setTimeout(300_000);
  const fixture = await installIdentitySwitchFixture(page);

  await gotoWithCompileRetry(page, `/test-fixtures/vendor-job-identity-isolation/${JOB_ID}`);
  await expect(page.getByRole("heading", { name: SENSITIVE_TITLE })).toBeVisible();
  await expect(page.getByText(`Client: ${SENSITIVE_CUSTOMER}`).first()).toBeVisible();
  await expect(page.getByText("Manager Work Record attestation", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Watch Starting Condition video" }).click();
  await expect.poll(fixture.lateDownloadRequested).toBe(true);

  await fixture.switchToCustomer();
  await expect.poll(fixture.customerProfileRequested).toBe(true);

  await expect(page.getByRole("heading", { name: SENSITIVE_TITLE })).toHaveCount(0);
  await expect(page.getByText(SENSITIVE_CUSTOMER, { exact: false })).toHaveCount(0);
  await expect(page.getByText("Manager Work Record attestation", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Checking vendor access...", { exact: true })).toBeVisible();

  const lateDownloadResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === `/api/vendors/${VENDOR_ID}/media/${ASSET_ID}/download`
  );
  fixture.releaseLateDownload();
  await lateDownloadResponse;
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.getByRole("dialog", { name: "Starting Condition Video" })).toHaveCount(0);

  fixture.releaseCustomerProfile();
  await expect(page.getByRole("heading", { name: "Vendor access required" })).toBeVisible();
  await expect(page.getByRole("heading", { name: SENSITIVE_TITLE })).toHaveCount(0);
  await expect(page.getByText(SENSITIVE_CUSTOMER, { exact: false })).toHaveCount(0);
});
