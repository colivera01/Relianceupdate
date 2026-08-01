import { describe, expect, it } from "vitest";
import { deriveVendorAnalyticsMetrics } from "@/lib/vendor-analytics";
import type { VendorDashboardResponse } from "@/types/vendor";

function dashboard(overrides: Partial<VendorDashboardResponse> = {}): VendorDashboardResponse {
  return {
    profile: {} as VendorDashboardResponse["profile"],
    stats: {
      totalBookings: 9,
      totalEarnings: 0,
      totalClients: 1,
      rating: 4.5,
      ratingCount: 1,
      completionEligibleBookingCount: 4,
    },
    recentJobs: [],
    archivedJobs: [],
    lifecycleCounts: {
      scheduled: 1,
      inProgress: 0,
      awaitingReview: 1,
      completed: 2,
      canceled: 0,
      rejected: 0,
      archived: 5,
    },
    recentReviews: [],
    insights: [],
    notifications: [],
    pendingModerationServiceOrderCount: 1,
    approvedServiceOrderCount: 1,
    archivedProofs: 16,
    ...overrides,
  };
}

describe("deriveVendorAnalyticsMetrics", () => {
  it("uses the same completion denominator and lifecycle counts as the vendor dashboard", () => {
    const metrics = deriveVendorAnalyticsMetrics(dashboard());

    expect(metrics.totalBookings).toBe(9);
    expect(metrics.completedJobs).toBe(2);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.awaitingReviewJobs).toBe(1);
  });

  it("reports archived service orders instead of archived media asset versions", () => {
    const metrics = deriveVendorAnalyticsMetrics(dashboard());

    expect(metrics.archivedServiceOrders).toBe(5);
    expect(metrics.archivedServiceOrders).not.toBe(16);
  });

  it("uses the approved review count instead of the truncated recent-review list", () => {
    const metrics = deriveVendorAnalyticsMetrics(
      dashboard({
        stats: {
          ...dashboard().stats,
          ratingCount: 2,
        },
        recentReviews: [],
      })
    );

    expect(metrics.reviewCoverage).toBe(100);
  });
});
