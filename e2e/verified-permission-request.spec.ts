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
    canDecide: options.canDecide ?? true,
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
    await expect(page.getByRole("heading", { name: "Confirm your authority" })).toBeVisible();
    await capture(page, path.join("Desktop", "04-authority-confirmation.png"));
  });

  test("captures desktop success and blocked states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await page.getByRole("button", { name: /Email code to/ }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await page.getByLabel("I am the customer").check();
    await page.getByRole("button", { name: "Allow recording" }).click();
    await expect(page.getByRole("heading", { name: "Recording is allowed" })).toBeVisible();
    await capture(page, path.join("Desktop", "05-recording-allowed.png"));

    await page.unrouteAll({ behavior: "wait" });
    await installControlledPermissionApi(page, { state: "expired", canDecide: false });
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "This secure link expired" })).toBeVisible();
    await capture(page, path.join("Desktop", "06-expired-blocked.png"));
  });

  test("captures desktop empty/error state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installControlledPermissionApi(page, { failInitialLoad: true });
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.locator("main [role='alert']")).toContainText("Unable to open this request");
    await capture(page, path.join("Desktop", "07-not-available-empty.png"));
  });

  test("captures mobile education and wrong-recipient success", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installControlledPermissionApi(page);
    await page.goto(`/consent/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Choose whether this service may be recorded" })).toBeVisible();
    await capture(page, path.join("Mobile", "01-permission-education.png"));
    await page.getByRole("button", { name: "This request is not for me" }).click();
    await expect(page.getByRole("heading", { name: "This request was reported as misdirected" })).toBeVisible();
    await capture(page, path.join("Mobile", "02-wrong-recipient-success.png"));
  });
});
