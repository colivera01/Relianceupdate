import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotRoot = path.join(
  process.cwd(),
  "Project Management",
  "Epic 7 - Withdrawal, Disputes, Retention and Final Disposition",
  "08_Screenshots",
);
const bookingId = "epic7-controlled-booking";
const assetId = "epic7-controlled-asset";

function authUser(role: "customer" | "vendor" | "admin") {
  return {
    id: `epic7-${role}`,
    name: `Epic 7 ${role}`,
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

interface LifecycleFixtureResponse {
  success: boolean;
  role: "CUSTOMER" | "VENDOR_MANAGER" | "EMPLOYEE";
  lifecycle: Array<{
    mediaAssetId: string;
    outcome: string;
    deletionStatus: string | null;
    caseStatus: string | null;
    holdStatus: string | null;
  }>;
  cases: Array<Record<string, unknown>>;
  withdrawals: Array<Record<string, unknown>>;
  deletions: Array<Record<string, unknown>>;
  holds: Array<Record<string, unknown>>;
  appeals: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  publicState: "PRIVATE" | "PUBLIC_REVIEW_PENDING" | "PUBLIC";
  allowedActions: {
    withdrawRecording: boolean;
    withdrawPublication: boolean;
    openDispute: boolean;
    requestDeletion: boolean;
    appeal: boolean;
  };
}

function lifecycleResponse(
  role: "CUSTOMER" | "VENDOR_MANAGER" | "EMPLOYEE",
): LifecycleFixtureResponse {
  return {
    success: true,
    role,
    lifecycle: [
      {
        mediaAssetId: assetId,
        outcome: "PRIVATE",
        deletionStatus: null,
        caseStatus: null,
        holdStatus: null,
      },
    ],
    cases: [],
    withdrawals: [],
    deletions: [],
    holds: [],
    appeals: [],
    auditEvents: [],
    publicState: "PRIVATE",
    allowedActions: {
      withdrawRecording: role !== "EMPLOYEE",
      withdrawPublication: true,
      openDispute: true,
      requestDeletion: role !== "EMPLOYEE",
      appeal: true,
    },
  };
}

async function installLifecycleFixture(
  page: Page,
  role: "CUSTOMER" | "VENDOR_MANAGER" | "EMPLOYEE",
  options: { delayMs?: number; fail?: boolean } = {},
) {
  let current = lifecycleResponse(role);
  await page.route(
    new RegExp(`/api/bookings/${bookingId}/lifecycle$`),
    async (route) => {
      if (options.delayMs)
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.fail) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Lifecycle status is temporarily unavailable.",
          }),
        });
        return;
      }
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const action = String(body.action || "");
        if (
          action === "WITHDRAW_PUBLICATION" ||
          action === "WITHDRAW_LIKENESS"
        ) {
          current = {
            ...current,
            lifecycle: [{ ...current.lifecycle[0], outcome: "RESTRICTED" }],
            withdrawals: [
              {
                id: "withdrawal-1",
                scope:
                  action === "WITHDRAW_LIKENESS" ? "LIKENESS" : "PUBLICATION",
                status: "APPLIED",
                appliedAt: new Date().toISOString(),
              },
            ],
          };
        }
        if (action === "REQUEST_DELETION") {
          current = {
            ...current,
            lifecycle: [
              {
                ...current.lifecycle[0],
                outcome: "RESTRICTED",
                deletionStatus: "ACCESS_RESTRICTED",
              },
            ],
            deletions: [
              {
                id: "deletion-1",
                mediaAssetId: assetId,
                status: "ACCESS_RESTRICTED",
                requestedAt: new Date().toISOString(),
              },
            ],
          };
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message:
              action === "REQUEST_DELETION"
                ? "Deletion was requested and access is restricted. This is not yet deleted."
                : "This version is no longer available publicly on Reliance.",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(current),
      });
    },
  );
}

test("customer sees a complete Private outcome and truthful withdrawal/deletion states", async ({
  page,
}) => {
  await installGeneralSession(page, "customer");
  await installLifecycleFixture(page, "CUSTOMER");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/test-fixtures/epic7-lifecycle?role=customer");

  const card = page.getByTestId("media-lifecycle-customer");
  await expect(
    card.getByText("No active restriction", { exact: true }),
  ).toBeVisible();
  await card.screenshot({
    path: path.join(screenshotRoot, "Desktop", "01-customer-private-empty.png"),
  });

  await card.getByRole("button", { name: "Prevent Public sharing" }).click();
  await expect(
    card.getByText("PUBLICATION withdrawal is applied."),
  ).toBeVisible();
  await card.screenshot({
    path: path.join(
      screenshotRoot,
      "Desktop",
      "02-customer-public-withdrawn.png",
    ),
  });

  await card
    .getByRole("button", { name: "Request deletion: media 1" })
    .click();
  await expect(
    card.getByText("Deletion requested, not yet deleted"),
  ).toBeVisible();
  await card.screenshot({
    path: path.join(
      screenshotRoot,
      "Desktop",
      "03-customer-deletion-requested.png",
    ),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await card.screenshot({
    path: path.join(
      screenshotRoot,
      "Mobile",
      "01-customer-deletion-requested.png",
    ),
  });
});

test("employee sees likeness-only withdrawal", async ({ page }) => {
  await installGeneralSession(page, "vendor");
  await installLifecycleFixture(page, "EMPLOYEE");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/epic7-lifecycle?role=employee");
  const card = page.getByTestId("media-lifecycle-employee");
  await expect(
    card.getByRole("button", { name: "Remove my likeness from Public use" }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Request deletion: media 1" }),
  ).toHaveCount(0);
  await card.screenshot({
    path: path.join(screenshotRoot, "Mobile", "02-employee-likeness-only.png"),
  });
});

test("vendor manager governance surface keeps the four governed actions separate", async ({ page }) => {
  await installGeneralSession(page, "vendor");
  await installLifecycleFixture(page, "VENDOR_MANAGER");
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.goto("/test-fixtures/epic7-lifecycle?role=vendor");
  const card = page.getByTestId("media-lifecycle-vendor");
  await expect(card.getByRole("button", { name: "Prevent future Public sharing" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Stop future recording" })).toBeVisible();
  await expect(card.getByText("Report a concern", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Request deletion: media 1" })).toBeVisible();
  await expect(card).toContainText("retention and legal-hold rules");
});

test("lifecycle loading and failure states explain what happened", async ({
  page,
}) => {
  await installGeneralSession(page, "customer");
  await installLifecycleFixture(page, "CUSTOMER", {
    delayMs: 1000,
    fail: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/epic7-lifecycle?role=customer");
  const card = page.getByTestId("media-lifecycle-customer");
  await expect(
    card.getByText("Loading lifecycle status...", { exact: true }),
  ).toBeVisible();
  await card.screenshot({
    path: path.join(screenshotRoot, "Mobile", "03-lifecycle-loading.png"),
  });
  await expect(
    card.getByText("Lifecycle status is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await card.screenshot({
    path: path.join(screenshotRoot, "Mobile", "04-lifecycle-failure.png"),
  });
});

test("admin sees restricted evidence and truthful deletion review states", async ({
  page,
}) => {
  await page.route("**/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, user: authUser("admin") }),
    });
  });
  await page.route("**/api/admin/media-lifecycle", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        cases: [
          {
            id: "case-1",
            bookingId,
            category: "PRIVACY",
            status: "RESTRICTED",
            reasonDetail: "A screen was visible in the final clip.",
          },
        ],
        deletions: [
          {
            id: "deletion-1",
            mediaAssetId: assetId,
            status: "ACCESS_RESTRICTED",
          },
        ],
        holds: [],
        appeals: [],
        failedJobs: [{ id: "job-1", status: "RETRY_REQUIRED" }],
      }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/test-fixtures/epic7-lifecycle?role=admin");
  const view = page.getByTestId("admin-media-lifecycle");
  await expect(
    view.getByText("This is not deleted until storage absence is verified."),
  ).toBeVisible();
  await expect(
    view.getByText(
      "Retry required. Stored-file absence has not been verified.",
    ),
  ).toBeVisible();
  await view.screenshot({
    path: path.join(screenshotRoot, "Desktop", "04-admin-lifecycle-queue.png"),
  });
});
