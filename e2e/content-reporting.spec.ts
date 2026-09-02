import { expect, test, type Page } from "@playwright/test";

const report = {
  id: "report-1",
  caseReference: "RP-A1B2C3D4",
  targetType: "media_asset",
  targetId: "asset-public",
  bookingId: "booking-report",
  vendorId: "vendor-1",
  reportedUserId: "customer-1",
  reportedVendorId: "vendor-1",
  reporterUserId: "customer-1",
  reporterVendorId: null,
  reporterRole: "customer",
  reasonCategory: "private_sensitive_information",
  reasonDetail: "A private address is visible.",
  status: "open",
  severity: "high",
  autoHidden: true,
  createdAt: "2026-09-02T12:00:00.000Z",
  resolvedAt: null,
  resolutionNotes: null,
  moderationHref: "/admin/media-moderation?search=asset-public",
  accessBasis: "OWNING_CUSTOMER_PUBLIC",
  packageId: "package-1",
  packageVersion: 2,
  packageHash: "package-hash",
  stageEvidenceId: "stage-1",
  stage: "INTRO",
  stageVersion: 1,
  stageHash: "stage-hash",
  mediaContentHash: "media-hash",
  adminAuditDecisionId: "audit-1",
  visibilityAtReport: "PUBLIC",
  currentVisibility: "PUBLIC_VISIBILITY_HOLD",
  publicHoldActive: true,
  policyCategory: "PRIVACY",
  serviceName: "Breaker Replacement",
  customerName: "Reliance Demo Customer",
  vendorName: "Electro LLC",
  events: [{ id: "event-1", eventType: "REPORT_CREATED", actorRole: "customer", createdAt: "2026-09-02T12:00:00.000Z" }],
};

async function installReportingApis(page: Page) {
  let holdActive = true;
  const submittedTargets: string[] = [];
  const adminActions: string[] = [];

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: { id: "customer-1", name: "Reliance Demo Customer", email: "customer@example.test", userType: "customer", availableProfiles: ["customer"] },
      }),
    });
  });

  await page.route("**/api/bookings/booking-report/visibility", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        canDecide: false,
        visibility: {
          state: holdActive ? "PUBLIC_VISIBILITY_HOLD" : "PUBLIC",
          auditPassed: true,
          privateProofReleased: true,
          publicRestrictionActive: holdActive,
          package: { id: "package-1", version: 2, packageHash: "package-hash", audioIncluded: false },
          visibilityDecision: { decision: "SHARE_PUBLICLY" },
        },
      }),
    });
  });

  await page.route("**/api/reports/content**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, reports: [] }) });
      return;
    }
    const body = route.request().postDataJSON() as { targetId: string };
    submittedTargets.push(body.targetId);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "We received your report.", report: { caseReference: body.targetId === "asset-private" ? "RP-PRIVATE1" : "RP-PUBLIC01", status: "Received" } }),
    });
  });

  await page.route("**/api/admin/reported-content**", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { action: string };
      adminActions.push(body.action);
      if (body.action === "release_public_hold") holdActive = false;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, reports: [{ ...report, autoHidden: holdActive, publicHoldActive: holdActive, currentVisibility: holdActive ? "PUBLIC_VISIBILITY_HOLD" : "PUBLIC" }] }),
    });
  });

  return { submittedTargets, adminActions };
}

test("customer and Public viewer reports identify the exact stage and return safe case references", async ({ page }) => {
  const observed = await installReportingApis(page);
  await page.goto("/test-fixtures/content-reporting");

  await page.getByRole("button", { name: "Report private video" }).click();
  const privateDialog = page.getByRole("dialog", { name: "Report this Private Proof stage" });
  await expect(privateDialog.getByRole("option", { name: "Person or voice shown without permission" })).toBeAttached();
  await expect(privateDialog.getByText("Having trouble playing this video?")).toBeVisible();
  await privateDialog.getByRole("button", { name: "Submit report" }).click();
  await expect(privateDialog).toContainText("RP-PRIVATE1");
  await privateDialog.getByRole("button", { name: "Close" }).first().click();

  await page.getByRole("button", { name: "Report public video" }).click();
  const publicDialog = page.getByRole("dialog", { name: "Report this Public Service Video stage" });
  await publicDialog.getByRole("button", { name: "Submit report" }).click();
  await expect(publicDialog).toContainText("RP-PUBLIC01");
  expect(observed.submittedTargets).toEqual(["asset-private", "asset-public"]);
});

test("customer sees a distinct Reliance Public hold while Private Proof stays preserved", async ({ page }) => {
  await installReportingApis(page);
  await page.goto("/test-fixtures/content-reporting");

  const visibility = page.getByTestId("package-visibility-customer");
  await expect(visibility).toContainText("Public visibility temporarily paused");
  await expect(visibility).toContainText("Public authorization and Private Proof remain preserved");
  await expect(visibility.getByRole("button", { name: "Make Private" })).toHaveCount(0);
});

test("Admin sees exact report evidence and explicitly releases a Public hold", async ({ page }) => {
  const observed = await installReportingApis(page);
  await page.goto("/test-fixtures/content-reporting");

  const queue = page.getByRole("region", { name: "Admin report queue" });
  await expect(queue).toContainText("RP-A1B2C3D4");
  await expect(queue).toContainText("Breaker Replacement");
  await expect(queue).toContainText("Electro LLC");
  await expect(queue).toContainText("Package hash: package-hash");
  await expect(queue).toContainText("Stage hash: stage-hash");
  await expect(queue.getByRole("link", { name: "Open matching moderation surface" })).toHaveAttribute("href", "/admin/media-moderation?search=asset-public");
  await queue.getByLabel("Resolution notes").fill("No violation found after exact-stage review.");
  await queue.getByRole("button", { name: "Release hold" }).click();
  await expect(queue.getByRole("button", { name: "Apply Public hold" })).toBeVisible();
  expect(observed.adminActions).toEqual(["release_public_hold"]);
});
