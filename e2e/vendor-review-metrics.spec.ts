import { expect, test, type Page } from "@playwright/test";
import { createAuthSessionCookie } from "../src/lib/auth-session";

const VENDOR_ID = "review-metrics-vendor";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3102";

async function installVendorReviewMetricsFixture(page: Page) {
  const session = createAuthSessionCookie({
    userId: "review-metrics-manager",
    email: "manager@example.test",
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
        id: "review-metrics-manager",
        name: "Morgan Manager",
        email: "manager@example.test",
        userType: "vendor",
        availableProfiles: ["vendor"],
      })
    );
  });

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "review-metrics-manager",
            name: "Morgan Manager",
            email: "manager@example.test",
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
            name: "Electro LLC",
            businessName: "Electro LLC",
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
        body: JSON.stringify({
          success: true,
          vendorId: VENDOR_ID,
          businessName: "Electro LLC",
          role: "MANAGER",
        }),
      });
      return;
    }
    if (pathname === "/api/vendor/session-guard") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, applies: true, nextCheckInMs: 60_000 }),
      });
      return;
    }
    if (pathname === `/api/vendors/${VENDOR_ID}/dashboard`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: VENDOR_ID, name: "Electro LLC", businessName: "Electro LLC" },
          stats: {
            totalBookings: 1,
            totalEarnings: 0,
            totalClients: 1,
            rating: 5,
            ratingCount: 1,
            publicWrittenReviewCount: 0,
            ratingDistribution: [
              { rating: 5, count: 1, percentage: 100 },
              { rating: 4, count: 0, percentage: 0 },
              { rating: 3, count: 0, percentage: 0 },
              { rating: 2, count: 0, percentage: 0 },
              { rating: 1, count: 0, percentage: 0 },
            ],
          },
          recentJobs: [],
          archivedJobs: [],
          recentReviews: [],
          employeePerformance: [
            {
              membershipId: "bradley-membership",
              displayName: "Bradley Coopers",
              averageRating: 3,
              reviewCount: 1,
            },
          ],
          insights: [],
          lifecycleCounts: {
            scheduled: 0,
            inProgress: 0,
            awaitingReview: 0,
            completed: 1,
            canceled: 0,
            archived: 0,
          },
          notifications: [],
          storageUsedBytes: "0",
          storageLimitBytes: "1",
          storagePercentUsed: 0,
        }),
      });
      return;
    }
    if (pathname === "/api/vendor/trust-score") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          trustScore: { scored: true, totalScorePct: 88, computedAt: "2026-09-07T12:00:00.000Z" },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });
}

test.describe("Vendor review metrics", () => {
  test("keeps verified ratings, public comments, employee ratings, and Trust Score distinct", async ({ page }) => {
    await installVendorReviewMetricsFixture(page);
    await page.goto("/test-fixtures/vendor-reviews");

    await expect(page.getByRole("heading", { name: "Reviews & Team Reputation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verified Customer Rating", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verified Customer Ratings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Public Written Reviews", exact: true })).toBeVisible();
    await expect(page.getByText("5.0", { exact: true })).toBeVisible();
    await expect(page.getByText("1 / 100.0%", { exact: true })).toBeVisible();
    await expect(page.getByText("Bradley Coopers", { exact: true })).toBeVisible();
    await expect(page.getByText("3.0", { exact: true })).toBeVisible();
    await expect(page.getByText("88%", { exact: true })).toBeVisible();
    await expect(page.getByText("Published Public Reviews", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Based on verified operational activity, not customer star ratings/)).toBeVisible();
  });
});
