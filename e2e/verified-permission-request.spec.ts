import path from "path";

import { expect, test, type Page } from "@playwright/test";

const TOKEN = "epic-1-controlled-fixture";
const SCREENSHOT_ROOT = path.join(process.cwd(), "output", "epic1-screenshot-package");

type FixtureOptions = {
  state?: string;
  canDecide?: boolean;
  initialDelayMs?: number;
  failVerification?: boolean;
  failInitialLoad?: boolean;
  contentVersion?: string;
  authorityRequirement?: {
    expectedAuthority: string | null;
    expectedClaimedRole: string | null;
    permittedClaimedRoles: string[];
    canAuthorizeInCurrentFlow: boolean;
    explanation: string;
  };
};

function permissionFixture(options: FixtureOptions = {}) {
  return {
    id: "permission-controlled-1",
    state: options.state ?? "pending",
    vendorName: "Northstar Home Services",
    serviceName: "Electrical safety inspection",
    scheduledFor: "2026-08-01T14:00:00.000Z",
    recordingLocation: "residence",
    audioEnabled: false,
    initialAudience: "private",
    recipientEmailMasked: "c***@example.test",
    recipientPhoneMasked: "(***) ***-0199",
    customerName: "Controlled Test Customer",
    actionExpiresAt: "2026-08-02T14:00:00.000Z",
    verificationOptions: { account: true, email: true, sms: true },
    plannedScope: {
      propertyScope: "customer_owned",
      peopleScope: "none",
      frameControl: "controlled",
      residenceInterior: true,
      businessInterior: false,
      minorMayAppear: false,
      protectedNonParticipantMayAppear: false,
      sensitiveInformationMayAppear: false,
      identifiersMayAppear: false,
      authorityHolderType: options.authorityRequirement?.expectedAuthority ?? "customer",
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
      audioEnabled: false,
      initialAudience: "private",
    },
    authorityRequirement: options.authorityRequirement ?? {
      expectedAuthority: "customer",
      expectedClaimedRole: "customer",
      permittedClaimedRoles: ["customer"],
      canAuthorizeInCurrentFlow: true,
      explanation: "The intended customer must verify the request and confirm customer authority.",
    },
    canDecide: options.canDecide ?? true,
    contentVersion: options.contentVersion ?? "recording-permission-v2-simplified-v1",
  };
}

async function installControlledPermissionApi(page: Page, options: FixtureOptions = {}) {
  await page.route("**/api/consent/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "GET" && pathname === `/api/consent/${TOKEN}`) {
      if (options.initialDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.initialDelayMs));
      }
      if (options.failInitialLoad) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "This recording request is not available." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, permission: permissionFixture(options) }),
      });
      return;
    }

    if (pathname.endsWith("/verification/start")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "If that verification option is available, a code has been sent." }),
      });
      return;
    }

    if (pathname.endsWith("/verification/verify")) {
      await route.fulfill({
        status: options.failVerification ? 422 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          options.failVerification
            ? { success: false, error: "Verification was not completed" }
            : { success: true, verified: true }
        ),
      });
      return;
    }

    if (pathname === "/api/consent/accept") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, permission: { state: "allowed", initialAudience: "private", audioEnabled: false } }),
      });
      return;
    }

    if (pathname === "/api/consent/decline" || pathname.endsWith("/wrong-recipient")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }

    await route.abort();
  });
}

async function capture(page: Page, relativePath: string) {
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.screenshot({ path: path.join(SCREENSHOT_ROOT, relativePath), fullPage: true });
}

test.describe("verified permission request UX", () => {
  test("captures desktop loading and education states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installControlledPermissionApi(page, { initialDelayMs: 900 });
    const navigation = page.goto(`/consent/${TOKEN}`);
    await expect(page.locator("[aria-busy='true']")).toBeVisible();
    await capture(page, path.join("Desktop", "01-loading.png"));
    await navigation;
    await expect(page.getByRole("heading", { name: "Choose whether this service may be recorded" })).toBeVisible();
    await expect(page.getByText("Private is the starting point")).toBeVisible();
    await capture(page, path.join("Desktop", "02-permission-education.png"));
  });

  test("captures desktop verification failure and authority states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installControlledPermissionApi(page, { failVerification: true });
    await page.goto(`/consent/${TOKEN}`);
    await page.getByRole("button", { name: /Email code to/ }).click();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.locator("main [role='alert']")).toContainText("Verification was not completed");
    await capture(page, path.join("Desktop", "03-verification-failure.png"));

    await page.unrouteAll({ behavior: "wait" });
    await installControlledPermissionApi(page);
    await page.reload();
    await page.getByRole("button", { name: /Email code to/ }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByRole("heading", { name: "Make your recording decision" })).toBeVisible();
    await expect(page.getByText(/verified the customer contact Reliance intended/)).toBeVisible();
    await expect(page.getByLabel("I am the customer")).toHaveCount(0);
    await expect(page.getByLabel("I am authorized for this customer and location")).toHaveCount(0);
    await expect(page.getByLabel("I represent this business location")).toHaveCount(0);
    await expect(page.getByLabel("I am the legal guardian of a minor")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "This Request Is Not for Me" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Allow Recording" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decline Recording" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decide later" })).toHaveCount(0);
    await expect(page.getByText("Is recording required")).toHaveCount(0);
    await capture(page, path.join("Desktop", "04-authority-confirmation.png"));
  });

  test("blocks an authority type the current beta cannot independently verify", async ({ page }) => {
    await installControlledPermissionApi(page, {
      contentVersion: "recording-permission-v1",
      authorityRequirement: {
        expectedAuthority: "guardian",
        expectedClaimedRole: "guardian",
        permittedClaimedRoles: [],
        canAuthorizeInCurrentFlow: false,
        explanation: "Reliance cannot verify guardian authority through the current beta request.",
      },
    });
    await page.goto(`/consent/${TOKEN}`);

    await expect(page.getByRole("heading", { name: "This request needs additional authority verification" })).toBeVisible();
    await expect(page.getByText(/Recording stays locked/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Allow recording" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Decide later" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Request Is Not for Me" })).toBeVisible();
  });

  test("captures desktop success and blocked states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await page.getByRole("button", { name: /Email code to/ }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await page.getByRole("button", { name: "Allow Recording" }).click();
    await expect(page.getByRole("heading", { name: "Recording is allowed" })).toBeVisible();
    await capture(page, path.join("Desktop", "05-recording-allowed.png"));

    await page.unrouteAll({ behavior: "wait" });
    await installControlledPermissionApi(page, { state: "expired", canDecide: false });
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "This secure link expired" })).toBeVisible();
    await capture(page, path.join("Desktop", "06-expired-blocked.png"));
  });

  test("presents the simplified V1 decision model and closes the Reliance work record after decline", async ({ page }) => {
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await page.getByRole("button", { name: /Email code to/ }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();

    await expect(page.getByRole("button", { name: "Allow Recording" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decline Recording" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Request Is Not for Me" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decide later" })).toHaveCount(0);

    await page.getByRole("button", { name: "Decline Recording" }).click();
    await expect(page.getByRole("heading", { name: "Recording declined" })).toBeVisible();
    await expect(page.getByText(/Reliance work record is closed/)).toBeVisible();
    await expect(page.getByText(/underlying vendor service/i)).toHaveCount(0);
  });

  test("captures desktop empty/error state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installControlledPermissionApi(page, { failInitialLoad: true });
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.locator("main [role='alert']")).toContainText("Unable to open this request");
    await capture(page, path.join("Desktop", "07-not-available-empty.png"));
  });

  test("explains that a superseded link was replaced", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installControlledPermissionApi(page, { state: "superseded", canDecide: false });
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "This permission request was replaced" })).toBeVisible();
    await expect(page.getByText(/Please use the newest link or contact the business/)).toBeVisible();
    await capture(page, path.join("Desktop", "08-superseded-request.png"));
  });

  test("survives refresh and reopening before the customer completes the flow", async ({ page, context }) => {
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Choose whether this service may be recorded" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Choose whether this service may be recorded" })).toBeVisible();

    await page.close();
    const reopened = await context.newPage();
    await installControlledPermissionApi(reopened);
    await reopened.goto(`/consent/${TOKEN}`);
    await reopened.getByRole("button", { name: /Email code to/ }).click();
    await reopened.getByLabel("6-digit code").fill("123456");
    await reopened.getByRole("button", { name: "Verify code" }).click();
    await reopened.getByRole("button", { name: "Allow Recording" }).click();
    await expect(reopened.getByRole("heading", { name: "Recording is allowed" })).toBeVisible();
  });

  test("captures mobile education and wrong-recipient success", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Choose whether this service may be recorded" })).toBeVisible();
    await capture(page, path.join("Mobile", "01-permission-education.png"));
    await page.getByRole("button", { name: "This Request Is Not for Me" }).click();
    await expect(page.getByRole("heading", { name: "This request was reported as misdirected" })).toBeVisible();
    await capture(page, path.join("Mobile", "02-wrong-recipient-success.png"));
  });
});
