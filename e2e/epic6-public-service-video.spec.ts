import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const screenshotRoot = path.join(
  process.cwd(),
  "Project Management",
  "Epic 6 - Exact-Media Public Proof and Admin Moderation",
  "08_Screenshots",
);
const bookingId = "epic6-controlled-booking";
const vendorId = "epic6-controlled-vendor";
const stageId = "epic6-final-stage";
const mediaAssetId = "epic6-final-media";

const proposal = {
  proposal: {
    id: "epic6-proposal-1",
    bookingId,
    vendorId,
    version: 1,
    proposalHash: "a".repeat(64),
    packageHash: "b".repeat(64),
    status: "AWAITING_CUSTOMER_DECISION",
  },
  stages: [
    {
      id: stageId,
      stage: "COMPLETED",
      mediaAssetId,
      contentHash: "c".repeat(64),
      presentationHash: "d".repeat(64),
      containsCustomerLikeness: false,
      containsEmployeeLikeness: false,
      includesAudio: false,
    },
  ],
  customerDecision: null,
  participantDecisions: [],
  vendorDecision: null,
  adminDecision: null,
};

function authUser(role: "customer" | "vendor" | "admin") {
  return {
    id: `epic6-${role}`,
    name: role === "vendor" ? "Controlled Proof Manager" : `Epic 6 ${role}`,
    email: `${role}@example.test`,
    userType: role,
    availableProfiles: [role],
  };
}

async function installGeneralSession(page: Page, role: "customer" | "vendor") {
  const user = authUser(role);
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, user }),
    });
  });
  await page.route("**/api/users/*/roles", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, availableProfiles: [role] }),
    });
  });
}

async function installPublicationFixture(
  page: Page,
  endpoint: RegExp,
  initial: typeof proposal | null,
  options: { delayMs?: number; fail?: boolean } = {},
) {
  let current = initial;
  await page.route(endpoint, async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.fail) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Public sharing status is temporarily unavailable." }),
      });
      return;
    }
    if (route.request().method() !== "GET") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body?.decisions) {
        current = current
          ? { ...current, proposal: { ...current.proposal, status: "AWAITING_VENDOR_APPROVAL" } }
          : current;
      } else if (body?.stageDecisions) {
        const allDeclined = Object.values(body.stageDecisions as Record<string, string>).every(
          (decision) => decision === "DECLINED",
        );
        current = current
          ? {
              ...current,
              proposal: {
                ...current.proposal,
                status: allDeclined ? "DECLINED_PRIVATE" : "AWAITING_VENDOR_APPROVAL",
              },
            }
          : current;
      } else if (route.request().method() === "POST") {
        current = proposal;
      } else {
        current = current
          ? { ...current, proposal: { ...current.proposal, status: "AWAITING_ADMIN_REVIEW" } }
          : current;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, publication: current }),
    });
  });
}

async function captureCard(page: Page, role: "vendor" | "customer" | "employee", folder: "Desktop" | "Mobile", name: string) {
  const card = page.getByTestId(`publication-${role}-card`);
  await expect(card).toBeVisible();
  await card.screenshot({ path: path.join(screenshotRoot, folder, name) });
}

test("vendor sees Final Result as the optional Public proposal default", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installGeneralSession(page, "vendor");
  await page.route("**/api/vendor/context", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, vendorId, role: "MANAGER", businessName: "Controlled Proof Services" }) });
  });
  await page.route("**/api/vendor/profile", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, profile: { id: vendorId, name: "Controlled Proof Services", businessName: "Controlled Proof Services", membershipStatus: "ACTIVE" } }) });
  });
  await page.route(`**/api/vendors/${vendorId}/jobs/${bookingId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, job: { id: bookingId, title: "Controlled outlet safety service", client: "Controlled Customer", status: "COMPLETED", serviceName: "Outlet Safety Review", assignedEmployees: ["Assigned Technician"] } }) });
  });
  await page.route(`**/api/vendors/${vendorId}/media/sessions**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, sessions: [] }) });
  });
  await installPublicationFixture(page, new RegExp(`/api/vendors/${vendorId}/jobs/${bookingId}/publication$`), null);

  await page.goto(`/test-fixtures/epic6-publication?role=vendor`);
  await expect(page.getByText("Final Result", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Private proof is complete on its own.")).toBeVisible();
  await captureCard(page, "vendor", "Desktop", "01-vendor-final-result-default.png");
});

test("customer can keep every exact clip Private on desktop and mobile", async ({ page }) => {
  await installGeneralSession(page, "customer");
  await page.route("**/api/customer/profile", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  await page.route(`**/api/bookings/${bookingId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, booking: { id: bookingId, title: "Controlled outlet safety service", status: "COMPLETED", booking_date: "2026-08-05", booking_time: "10:00", service: { id: "service-1", name: "Outlet Safety Review" }, vendor: { id: vendorId, businessName: "Controlled Proof Services" } }, customerLifecycle: null, customerReview: null }) });
  });
  await page.route(`**/api/bookings/${bookingId}/media`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, privateProofStatus: "AVAILABLE", assets: [], videos: [] }) });
  });
  await page.route(`**/api/bookings/${bookingId}/media/${mediaAssetId}/download`, async (route) => {
    await route.fulfill({ status: 204 });
  });
  await installPublicationFixture(page, new RegExp(`/api/bookings/${bookingId}/publication$`), proposal);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/test-fixtures/epic6-publication?role=customer`);
  await expect(page.getByRole("button", { name: "Keep all proof Private" })).toBeVisible();
  await captureCard(page, "customer", "Desktop", "02-customer-exact-media-choice.png");
  await page.getByRole("button", { name: "Keep all proof Private" }).click();
  await expect(page.getByText("Kept Private", { exact: true })).toBeVisible();
  await captureCard(page, "customer", "Desktop", "03-customer-private-outcome.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await captureCard(page, "customer", "Mobile", "01-customer-private-outcome.png");
});

test("employee sees a participant-only decision and a truthful failure state", async ({ page }) => {
  await installGeneralSession(page, "vendor");
  const participantProposal = {
    ...proposal,
    proposal: { ...proposal.proposal, status: "AWAITING_PARTICIPANT_DECISIONS" },
    stages: [{ ...proposal.stages[0], containsEmployeeLikeness: true }],
  };
  await installPublicationFixture(page, new RegExp(`/api/employee/jobs/${bookingId}/publication$`), participantProposal);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/test-fixtures/epic6-publication?role=employee`);
  await expect(page.getByRole("button", { name: "Approve my appearance and audio" })).toBeVisible();
  await captureCard(page, "employee", "Desktop", "04-employee-participant-decision.png");

  await page.getByRole("button", { name: "Approve my appearance and audio" }).click();
  await expect(page.getByText("Ready for vendor representation approval", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await captureCard(page, "employee", "Mobile", "02-employee-decision-saved.png");
});

test("publication loading and failure states are explicit", async ({ page }) => {
  await installGeneralSession(page, "vendor");
  await installPublicationFixture(
    page,
    new RegExp(`/api/employee/jobs/${bookingId}/publication$`),
    proposal,
    { delayMs: 1200, fail: true },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/test-fixtures/epic6-publication?role=employee`);
  await expect(page.getByText("Loading sharing status...", { exact: true })).toBeVisible();
  await captureCard(page, "employee", "Mobile", "03-publication-loading.png");
  await expect(page.getByText("Public sharing status is temporarily unavailable.", { exact: true })).toBeVisible();
  await captureCard(page, "employee", "Mobile", "04-publication-failure.png");
});

test("admin sees exact hashes and cannot broaden participant approval", async ({ page }) => {
  await page.route("**/admin/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, user: authUser("admin") }) });
  });
  await page.route("**/api/admin/publication-proposals", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, proposals: [{ ...proposal, proposal: { ...proposal.proposal, status: "AWAITING_ADMIN_REVIEW" }, customerDecision: { decision: "APPROVED_ALL" }, vendorDecision: { decision: "APPROVED" }, booking: { title: "Controlled outlet safety service", clientName: "Controlled Customer", vendor: { businessName: "Controlled Proof Services" }, service: { name: "Outlet Safety Review" } } }] }) });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/test-fixtures/epic6-publication?role=admin");
  await expect(page.getByRole("heading", { name: "Public Service Video Review" })).toBeVisible();
  await expect(page.getByText(/Media hash:/)).toBeVisible();
  await page.getByTestId("admin-publication-moderation").screenshot({ path: path.join(screenshotRoot, "Desktop", "05-admin-exact-media-review.png") });
});
