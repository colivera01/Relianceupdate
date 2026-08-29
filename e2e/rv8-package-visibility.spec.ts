import { expect, test, type Page } from "@playwright/test";

const bookingId = "rv8-package-visibility-booking";

async function installSession(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: "customer-1",
          name: "Controlled Customer",
          email: "customer@example.test",
          userType: "customer",
          availableProfiles: ["customer"],
        },
      }),
    });
  });
  await page.route("**/api/users/*/roles", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, availableProfiles: ["customer"] }) });
  });
}

function visibility(state: string, audioIncluded = false) {
  return {
    success: true,
    role: "CUSTOMER",
    canDecide: true,
    visibility: {
      state,
      auditPassed: true,
      privateProofReleased: true,
      package: { id: "package-1", version: 3, packageHash: "package-hash", audioIncluded },
      visibilityDecision: null,
      proposal: null,
      legacyProposal: null,
    },
  };
}

test("customer explicitly authorizes the complete package for separate Public review", async ({ page }) => {
  await installSession(page);
  let current = visibility("PRIVATE_DEFAULT");
  const decisions: string[] = [];
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      const decision = String(route.request().postDataJSON()?.decision || "");
      decisions.push(decision);
      current = visibility(decision === "SHARE_PUBLICLY" ? "PUBLIC_REVIEW_PENDING" : "PRIVATE");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  const card = page.getByTestId("package-visibility-customer");
  await expect(card.getByText("Private by default", { exact: true })).toBeVisible();
  await expect(page.getByText("Privacy, concerns, and retention", { exact: true })).toHaveCount(0);
  await expect(card).toContainText("Starting Condition, Work in Progress, and Final Result stay together");
  await card.getByRole("button", { name: "Share Publicly" }).click();
  await expect(page.getByTestId("package-public-confirmation")).toContainText("all three exact Admin-approved stages");
  expect(decisions).toEqual([]);
  await page.getByRole("button", { name: "Authorize Public Review" }).click();
  await expect(card.getByText("Public Review Pending", { exact: true })).toBeVisible();
  await expect(card).toContainText("It is not Public yet");
  expect(decisions).toEqual(["SHARE_PUBLICLY"]);
  await expect(card.getByText(/Starting Condition Public checkbox/i)).toHaveCount(0);
});

test("vendor visibility is read-only and audit pending does not imply completed Private Proof", async ({ page }) => {
  await installSession(page);
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...visibility("AUDIT_PENDING"),
        role: "VENDOR_MANAGER",
        canDecide: false,
        visibility: {
          ...visibility("AUDIT_PENDING").visibility,
          auditPassed: false,
          privateProofReleased: false,
        },
      }),
    });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=vendor");
  const card = page.getByTestId("package-visibility-vendor");
  await expect(card.getByText("Private Proof locked", { exact: true })).toBeVisible();
  await expect(card).toContainText("until Reliance Audit passes");
  await expect(card.getByRole("button", { name: "Keep Private" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Share Publicly" })).toHaveCount(0);
});

test("customer must explicitly confirm that an audio-containing complete package may enter Public review", async ({ page }) => {
  await installSession(page);
  let current = visibility("PRIVATE_DEFAULT", true);
  const requests: Array<Record<string, unknown>> = [];
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      requests.push(route.request().postDataJSON());
      current = visibility("PUBLIC_REVIEW_PENDING", true);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  await page.getByRole("button", { name: "Share Publicly" }).click();
  const confirmation = page.getByTestId("package-public-confirmation");
  await expect(confirmation).toContainText("This Service Video contains audio");
  await expect(confirmation).toContainText("audio may become publicly viewable");
  expect(requests).toEqual([]);

  await confirmation.getByRole("button", { name: "Authorize Public Review" }).click();
  expect(requests).toEqual([expect.objectContaining({
    decision: "SHARE_PUBLICLY",
    audioConfirmation: true,
  })]);
});
