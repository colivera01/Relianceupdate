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
      publicDisplayEligibility: "PUBLIC_DISPLAY_ELIGIBLE",
      visibilityContractVersion: 3,
      package: { id: "package-1", version: 3, packageHash: "package-hash", audioIncluded },
      visibilityDecision: null,
      proposal: null,
      legacyProposal: null,
    },
  };
}

test("customer explicitly confirms immediate Public visibility for the complete package", async ({ page }) => {
  await installSession(page);
  let current = visibility("PRIVATE_DEFAULT");
  const decisions: string[] = [];
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      const decision = String(route.request().postDataJSON()?.decision || "");
      decisions.push(decision);
      current = visibility(decision === "SHARE_PUBLICLY" ? "PUBLIC" : "PRIVATE");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, proposal: decision === "SHARE_PUBLICLY" ? { status: "PUBLIC" } : null }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  const card = page.getByTestId("package-visibility-customer");
  await expect(card.getByText("Private", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Privacy, concerns, and retention", { exact: true })).toHaveCount(0);
  await expect(card).toContainText("Starting Condition, Work in Progress, and Final Result always stay together");
  await expect(card.getByRole("button", { name: "Keep Private" })).toHaveCount(0);
  await card.getByRole("button", { name: "Share Publicly" }).click();
  await expect(page.getByTestId("package-public-confirmation")).toContainText("will become publicly viewable on Reliance");
  expect(decisions).toEqual([]);
  await page.getByRole("button", { name: "Confirm Share Publicly" }).click();
  await expect(card.getByText("Public", { exact: true }).first()).toBeVisible();
  await expect(card).toContainText("publicly viewable on Reliance");
  await expect(card.getByRole("button", { name: "Make Private" })).toBeVisible();
  await expect(card.getByText(/Public Review Pending/i)).toHaveCount(0);
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

test("customer must explicitly confirm audio before the complete package becomes Public", async ({ page }) => {
  await installSession(page);
  let current = visibility("PRIVATE_DEFAULT", true);
  const requests: Array<Record<string, unknown>> = [];
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      requests.push(route.request().postDataJSON());
      current = visibility("PUBLIC", true);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, proposal: { status: "PUBLIC" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  await page.getByRole("button", { name: "Share Publicly" }).click();
  const confirmation = page.getByTestId("package-public-confirmation");
  await expect(confirmation).toContainText("This Service Video contains audio");
  await expect(confirmation).toContainText("audio will become publicly viewable");
  expect(requests).toEqual([]);

  await confirmation.getByRole("button", { name: "Confirm Share Publicly" }).click();
  expect(requests).toEqual([expect.objectContaining({
    decision: "SHARE_PUBLICLY",
    audioConfirmation: true,
  })]);
});

test("Public visibility can be made Private immediately without losing Private Proof", async ({ page }) => {
  await installSession(page);
  let current = visibility("PUBLIC");
  const decisions: string[] = [];
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      decisions.push(String(route.request().postDataJSON()?.decision || ""));
      current = visibility("PRIVATE");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, proposal: null }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  await page.getByRole("button", { name: "Make Private" }).click();
  const confirmation = page.getByTestId("package-private-confirmation");
  await expect(confirmation).toContainText("still have access through your Private Proof");
  await confirmation.getByRole("button", { name: "Confirm Make Private" }).click();
  await expect(page.getByTestId("package-visibility-customer")).toContainText("Your Service Video is visible only to you");
  expect(decisions).toEqual(["KEEP_PRIVATE"]);
});

test("a customer can share the same unchanged package again after making it Private", async ({ page }) => {
  await installSession(page);
  let current = visibility("PRIVATE");
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    if (route.request().method() === "POST") {
      current = visibility("PUBLIC");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, proposal: { status: "PUBLIC" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  await page.getByRole("button", { name: "Share Publicly" }).click();
  await page.getByRole("button", { name: "Confirm Share Publicly" }).click();
  await expect(page.getByRole("button", { name: "Make Private" })).toBeVisible();
});

test("missing participant permission keeps the package Private without review terminology", async ({ page }) => {
  await installSession(page);
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(visibility("PUBLIC_WAITING_PERMISSION")) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  const card = page.getByTestId("package-visibility-customer");
  await expect(card).toContainText("Waiting for Public-sharing permission");
  await expect(card).toContainText("remains Private");
  await expect(card.getByText(/Public Review/i)).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Share Publicly" })).toHaveCount(0);
});

test("Private-only Audit outcome explains that Public display is unavailable", async ({ page }) => {
  await installSession(page);
  const current = visibility("PRIVATE_ONLY");
  current.canDecide = false;
  current.visibility.publicDisplayEligibility = "PRIVATE_ONLY";
  await page.route(new RegExp(`/api/bookings/${bookingId}/visibility$`), async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });

  await page.goto("/test-fixtures/rv8-package-visibility?role=customer");
  const card = page.getByTestId("package-visibility-customer");
  await expect(card).toContainText("not eligible for Public display");
  await expect(card.getByRole("button", { name: "Share Publicly" })).toHaveCount(0);
});
