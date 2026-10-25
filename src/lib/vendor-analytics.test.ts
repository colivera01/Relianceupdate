import { describe, expect, it } from "vitest";
import {
  deriveVendorAnalyticsMetrics,
  selectMostRecentPublicReview,
  selectTopRatedTeamMember,
} from "@/lib/vendor-analytics";
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

    expect(metrics.archivedJobs).toBe(5);
    expect(metrics.archivedJobs).not.toBe(16);
  });

  it("uses the verified rating count instead of the truncated public-review list", () => {
    const metrics = deriveVendorAnalyticsMetrics(
      dashboard({
        stats: {
          ...dashboard().stats,
          ratingCount: 2,
        },
        recentReviews: [],
      })
    );

    expect(metrics.verifiedRatingCoverage).toBe(100);
  });

  it("clamps stale or malformed dashboard values to usable display ranges", () => {
    const metrics = deriveVendorAnalyticsMetrics(
      dashboard({
        stats: {
          ...dashboard().stats,
          totalBookings: Number.NaN,
          rating: 8,
          ratingCount: 4,
          completionEligibleBookingCount: 1,
        },
        lifecycleCounts: {
          ...dashboard().lifecycleCounts!,
          completed: 2,
        },
        storagePercentUsed: 142,
      }),
    );

    expect(metrics.totalBookings).toBe(0);
    expect(metrics.rating).toBe(5);
    expect(metrics.completionRate).toBe(100);
    expect(metrics.verifiedRatingCoverage).toBe(100);
    expect(metrics.storagePercent).toBe(100);
  });

  it("uses unique eligible Service Order counts supplied by the dashboard for rating participation", () => {
    const metrics = deriveVendorAnalyticsMetrics(
      dashboard({
        stats: {
          ...dashboard().stats,
          ratingCount: 9,
          ratingEligibleServiceOrderCount: 4,
          verifiedRatedServiceOrderCount: 2,
        },
      })
    );

    expect(metrics.ratingCoverageNumerator).toBe(2);
    expect(metrics.ratingCoverageDenominator).toBe(4);
    expect(metrics.verifiedRatingCoverage).toBe(50);
  });

  it("calculates storage percentage from exact bytes instead of a separately rounded value", () => {
    const metrics = deriveVendorAnalyticsMetrics(
      dashboard({
        storageUsedBytes: String(50 * 1024 * 1024),
        storageLimitBytes: String(1024 * 1024 * 1024),
        storagePercentUsed: 4,
      })
    );

    expect(metrics.storagePercent).toBe(4.88);
    expect(metrics.storageUsedBytes).toBe(50 * 1024 * 1024);
    expect(metrics.storageLimitBytes).toBe(1024 * 1024 * 1024);
  });

  it("reconciles every current Work Record status to the headline total", () => {
    const metrics = deriveVendorAnalyticsMetrics(dashboard());

    expect(metrics.statusTotal).toBe(9);
    expect(metrics.unclassifiedJobs).toBe(0);
    expect(metrics.statusCountMatchesTotal).toBe(true);
  });

  it("selects team highlights deterministically and rejects invalid rating rows", () => {
    const selected = selectTopRatedTeamMember([
      { membershipId: "z", displayName: "Zoe", averageRating: 5, reviewCount: 1 },
      { membershipId: "b", displayName: "Bradley", averageRating: 5, reviewCount: 3 },
      { membershipId: "bad", displayName: "Invalid", averageRating: 0, reviewCount: 8 },
    ]);

    expect(selected?.displayName).toBe("Bradley");
  });

  it("selects the newest usable public review even when the input is unsorted", () => {
    const selected = selectMostRecentPublicReview([
      { id: "old", client: "A", rating: 4, comment: "Older", date: "2026-01-01T00:00:00.000Z", jobType: "A" },
      { id: "blank", client: "B", rating: 5, comment: " ", date: "2026-04-01T00:00:00.000Z", jobType: "B" },
      { id: "new", client: "C", rating: 5, comment: "Newest", date: "2026-03-01T00:00:00.000Z", jobType: "C" },
    ]);

    expect(selected?.id).toBe("new");
  });
});
