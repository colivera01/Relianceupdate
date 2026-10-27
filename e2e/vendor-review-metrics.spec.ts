import { expect, test, type Page } from "@playwright/test";
import { createAuthSessionCookie } from "../src/lib/auth-session";

const VENDOR_ID = "review-metrics-vendor";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3102";

async function installVendorReviewMetricsFixture(
  page: Page,
  options: {
    rating?: number;
    ratingCount?: number;
    employeeRating?: number;
    employeeReviewCount?: number;
    populatedAnalytics?: boolean;
  } = {}
) {
  const populatedAnalytics = options.populatedAnalytics ?? false;
  const rating = options.rating ?? 5;
  const ratingCount = options.ratingCount ?? 1;
  const employeeRating = options.employeeRating ?? 3;
  const employeeReviewCount = options.employeeReviewCount ?? 1;
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
            onboarding: {
              membershipStatus: "ACTIVE",
              isPubliclyListed: true,
              publiclyListedAt: "2026-06-08T00:00:00.000Z",
              serviceDraftCount: 3,
              publishedServiceCount: 3,
              missingProfileFields: [],
              hasRequiredProfileFields: true,
              readyForAdminReview: true,
              readyForPublicVisibility: true,
              vendorVisibleToPublic: true,
              approvalLabel: "Approved for vendor access",
              publicVisibilityLabel: "Publicly visible",
              nextStep: "Your vendor listing is publicly visible.",
              checklist: [],
            },
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
            totalBookings: populatedAnalytics ? 8 : 1,
            totalEarnings: 0,
            totalClients: 1,
            rating: populatedAnalytics ? 4.5 : rating,
            ratingCount: populatedAnalytics ? 2 : ratingCount,
            publicWrittenReviewCount: populatedAnalytics ? 2 : 0,
            completionEligibleBookingCount: populatedAnalytics ? 5 : 1,
            ratingEligibleServiceOrderCount: populatedAnalytics ? 4 : 1,
            verifiedRatedServiceOrderCount: populatedAnalytics ? 2 : ratingCount > 0 ? 1 : 0,
            ratingDistribution: populatedAnalytics
              ? [
                  { rating: 5, count: 1, percentage: 50 },
                  { rating: 4, count: 1, percentage: 50 },
                  { rating: 3, count: 0, percentage: 0 },
                  { rating: 2, count: 0, percentage: 0 },
                  { rating: 1, count: 0, percentage: 0 },
                ]
              : [
                  { rating: 5, count: ratingCount > 0 && rating === 5 ? ratingCount : 0, percentage: ratingCount > 0 && rating === 5 ? 100 : 0 },
                  { rating: 4, count: 0, percentage: 0 },
                  { rating: 3, count: 0, percentage: 0 },
                  { rating: 2, count: 0, percentage: 0 },
                  { rating: 1, count: 0, percentage: 0 },
                ],
          },
          recentJobs: [],
          archivedJobs: [],
          recentReviews: populatedAnalytics
            ? [
                {
                  id: "review-new",
                  client: "Riley Customer",
                  rating: 5,
                  comment: "Clear work and an excellent final result.",
                  date: "2026-10-23T00:00:00.000Z",
                  createdAt: "2026-10-23T18:30:00.000Z",
                  jobType: "Outlet Installation",
                },
                {
                  id: "review-old",
                  client: "Pat Customer",
                  rating: 4,
                  comment: "Older review.",
                  date: "2026-10-23T00:00:00.000Z",
                  createdAt: "2026-10-23T16:30:00.000Z",
                  jobType: "Breaker Replacement",
                },
              ]
            : [],
          employeePerformance: populatedAnalytics
            ? [
                {
                  membershipId: "zoe-membership",
                  displayName: "Zoe Rivera",
                  averageRating: 5,
                  reviewCount: 1,
                },
                {
                  membershipId: "bradley-membership",
                  displayName: "Bradley Coopers",
                  averageRating: 5,
                  reviewCount: 3,
                },
              ]
            : [
                {
                  membershipId: "bradley-membership",
                  displayName: "Bradley Coopers",
                  averageRating: employeeRating,
                  reviewCount: employeeReviewCount,
                },
              ],
          insights: [],
          lifecycleCounts: {
            scheduled: populatedAnalytics ? 1 : 0,
            inProgress: populatedAnalytics ? 1 : 0,
            awaitingReview: populatedAnalytics ? 1 : 0,
            completed: populatedAnalytics ? 2 : 1,
            canceled: populatedAnalytics ? 1 : 0,
            rejected: populatedAnalytics ? 1 : 0,
            archived: populatedAnalytics ? 1 : 0,
          },
          notifications: [],
          pendingModerationServiceOrderCount: populatedAnalytics ? 1 : 0,
          approvedServiceOrderCount: populatedAnalytics ? 3 : 0,
          publicServiceOrderCount: populatedAnalytics ? 1 : 0,
          storageUsedBytes: populatedAnalytics ? String(50 * 1024 * 1024) : "0",
          storageLimitBytes: populatedAnalytics ? String(1024 * 1024 * 1024) : "1",
          storagePercentUsed: populatedAnalytics ? 4 : 0,
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
          scoreVersion: 3,
          verifiedAt: "2026-10-24T12:00:00.000Z",
          trustScore: {
            scored: true,
            scoreVersion: 3,
            totalScorePct: 88,
            computedAt: "2026-09-07T12:00:00.000Z",
            presentation: {
              maturityState: "emerging",
              maturityLabel: "Emerging",
              title: "Emerging reliability score",
              scoreDisplay: "88/100",
              summary: "88/100 with growing finalized activity",
            },
            components: {
              workflowCompletion: { pct: 100, numerator: 5, denominator: 5, weightPct: 35 },
              videoVerification: { pct: 70, numerator: 7, denominator: 10, weightPct: 30 },
              disputeFree: { pct: 90, numerator: 9, denominator: 10, weightPct: 35 },
              operationalReliability: { pct: null, numerator: 0, denominator: 0, weightPct: 0 },
            },
            explanationDetails: {
              overview: "The current score is based on finalized Reliance activity.",
              coverageSummary: "All three active Trust Score components are measurable.",
              strongestSignals: ["Workflow completion is fully verified."],
              watchItems: ["Video verification has room to improve."],
              methodology: ["Customer ratings do not change the Trust Score."],
            },
            separation: "The Reliance Trust Score is separate from Customer Ratings; it does not use reviews.",
            improvementHints: ["Improve staged-video capture quality."],
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });
}

test.describe("Vendor review metrics", () => {
  test("projects a newly verified rating without publishing its unmoderated written comment or changing Trust Score", async ({ page }) => {
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

  test("does not present zero ratings as a poor 0.0 score", async ({ page }) => {
    await installVendorReviewMetricsFixture(page, {
      rating: 0,
      ratingCount: 0,
      employeeRating: 0,
      employeeReviewCount: 0,
    });
    await page.goto("/test-fixtures/vendor-reviews");

    await expect(page.getByText("Not yet rated", { exact: true })).toHaveCount(2);
    await expect(page.getByText("0.0", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/first verified customer star rating will establish this average/i)).toBeVisible();
    await expect(page.getByText("88%", { exact: true })).toBeVisible();

    await page.goto("/test-fixtures/rv8-vendor-dashboard");
    await expect(page.getByRole("heading", { name: "Customer confidence snapshot" })).toBeVisible();
    await expect(page.getByText("Not yet rated", { exact: true })).toBeVisible();
    await expect(page.getByText("0.0", { exact: true })).toHaveCount(0);

  });

  test("keeps an unrated analytics account neutral instead of showing a poor rating", async ({ page }, testInfo) => {
    await installVendorReviewMetricsFixture(page, {
      rating: 0,
      ratingCount: 0,
      employeeRating: 0,
      employeeReviewCount: 0,
    });
    await page.goto("/test-fixtures/vendor-analytics");
    await expect(page.getByText("Customer rating", { exact: true })).toBeVisible();
    await expect(page.getByText("Not yet rated", { exact: true })).toBeVisible();
    await expect(page.getByText("0.0★", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Reliance Trust Score" })).toBeVisible();
    await expect(page.getByText("88", { exact: true })).toBeVisible();
    await expect(page.getByText("/100", { exact: true })).toBeVisible();
    await expect(page.getByText("Operational reliability", { exact: true })).toHaveCount(0);
    await page.locator("summary").filter({ hasText: "How the score is calculated" }).click();
    await expect(page.getByText("Methodology", { exact: true })).toBeVisible();
    const refreshRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/api/vendor/trust-score" &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await refreshRequest;
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("vendor-analytics-desktop.png"), fullPage: true });
  });

  test("keeps analytics readable without horizontal overflow on mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorReviewMetricsFixture(page, {
      rating: 0,
      ratingCount: 0,
      employeeRating: 0,
      employeeReviewCount: 0,
    });
    await page.goto("/test-fixtures/vendor-analytics");

    await expect(page.getByRole("heading", { name: "Analytics & Trust" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reliance Trust Score" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("vendor-analytics-mobile.png"), fullPage: true });
  });

  test("populates trust highlights and reconciles recent activity from canonical counts", async ({ page }, testInfo) => {
    await installVendorReviewMetricsFixture(page, { populatedAnalytics: true });
    await page.goto("/test-fixtures/vendor-analytics");

    await expect(page.getByText(/Version 3/i)).toHaveCount(0);
    await expect(page.getByText("Verified rating participation", { exact: true })).toBeVisible();
    await expect(page.getByText("2 of 4 completed, approved Service Orders received a verified customer star rating.", { exact: false })).toBeVisible();
    await expect(page.getByText("50.0 MB used of 1.00 GB.", { exact: false })).toBeVisible();
    await expect(page.getByText("4.9%", { exact: true })).toBeVisible();
    await expect(page.getByText("1 pending Reliance Audit", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("3 approved Private Proof", { exact: true })).toBeVisible();
    await expect(page.getByText("1 shared publicly", { exact: true })).toBeVisible();
    await expect(page.getByText("8 of 8 Work Records are represented", { exact: false })).toBeVisible();

    await expect(page.getByText("Highest current employee rating", { exact: true })).toBeVisible();
    await expect(page.getByText("Bradley Coopers", { exact: true })).toBeVisible();
    await expect(page.getByText("5.0★ average across 3 verified employee ratings.", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear work and an excellent final result.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("5.0 out of 5 stars")).toBeVisible();
    await expect(page.getByText("Older review.", { exact: true })).toHaveCount(0);

    const dashboardRefresh = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === `/api/vendors/${VENDOR_ID}/dashboard` && url.searchParams.get("refresh") === "1";
    });
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await dashboardRefresh;
    await page.screenshot({ path: testInfo.outputPath("populated-vendor-analytics.png"), fullPage: true });
  });

  test("keeps the vendor dashboard metrics precise and shows exactly one newest public review", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1728, height: 900 });
    await installVendorReviewMetricsFixture(page, { populatedAnalytics: true });
    await page.goto("/test-fixtures/rv8-vendor-dashboard");

    await expect(page.getByRole("button", { name: "Refresh dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Active work" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trust and public proof" })).toBeVisible();
    await expect(page.getByTestId("dashboard-metric-card")).toHaveCount(8);
    await expect(page.getByTestId("business-visibility-metric-card")).toHaveCount(4);
    const visibilityCardSurfaces = await page
      .getByTestId("business-visibility-metric-card")
      .evaluateAll((cards) =>
        cards.map((card) => {
          const styles = window.getComputedStyle(card);
          return `${styles.backgroundColor}|${styles.borderColor}`;
        }),
      );
    expect(new Set(visibilityCardSurfaces).size).toBe(1);
    const metricGridColumns = await page.getByTestId("dashboard-metric-grid").evaluateAll((grids) =>
      grids.map((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(" ").length),
    );
    expect(metricGridColumns).toEqual([4, 4]);
    const metricOverviewBox = await page.getByTestId("dashboard-metric-overview").boundingBox();
    expect(metricOverviewBox?.height).toBeLessThan(650);
    await expect(page.getByRole("heading", { name: "Completion rate" })).toBeVisible();
    await expect(page.getByText("2 completed of 5 eligible Work Records. Canceled, rejected, and archived records are excluded.", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Employee rating highlight" })).toBeVisible();
    await expect(page.getByText("Bradley Coopers", { exact: true })).toBeVisible();
    await expect(page.getByText("3 verified employee ratings", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Most recent public review" })).toBeVisible();
    await expect(page.getByText("Clear work and an excellent final result.", { exact: true })).toBeVisible();
    await expect(page.getByText("Older review.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Showing the newest of 2 public reviews.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View all public reviews (2)" })).toHaveAttribute("href", "/vendor/reviews");

    await expect(page.getByText("50.0 MB / 1.00 GB", { exact: true })).toBeVisible();
    await expect(page.getByText("4.9% of quota used.", { exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Storage quota used" })).toHaveAttribute("aria-valuenow", "4.88");

    await expect(page.getByRole("link", { name: /Review which approved Service Orders are public/ })).toHaveAttribute("href", "/vendor/jobs");
    await expect(page.getByText(/promotion request/i)).toHaveCount(0);

    const dashboardRefresh = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === `/api/vendors/${VENDOR_ID}/dashboard` && url.searchParams.get("refresh") === "1";
    });
    await page.getByRole("button", { name: "Refresh dashboard" }).click();
    await dashboardRefresh;
    await expect(page.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("vendor-dashboard-desktop.png"), fullPage: true });
  });

  test("keeps the corrected dashboard readable on mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVendorReviewMetricsFixture(page, { populatedAnalytics: true });
    await page.goto("/test-fixtures/rv8-vendor-dashboard");

    await expect(page.getByRole("heading", { name: "Most recent public review" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View all public reviews (2)" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("vendor-dashboard-mobile.png"), fullPage: true });
  });
});
