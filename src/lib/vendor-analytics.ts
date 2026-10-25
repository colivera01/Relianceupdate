import type { VendorDashboardResponse } from "@/types/vendor";

export type VendorAnalyticsMetrics = {
  totalBookings: number;
  totalClients: number;
  rating: number;
  ratingCount: number;
  approvedServiceOrders: number;
  pendingServiceOrders: number;
  archivedServiceOrders: number;
  totalProofAssets: number;
  storagePercent: number;
  completedJobs: number;
  inProgressJobs: number;
  scheduledJobs: number;
  awaitingReviewJobs: number;
  completionRate: number;
  verifiedRatingCoverage: number;
};

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function count(value: unknown): number {
  return Math.floor(nonNegativeNumber(value));
}

function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function deriveVendorAnalyticsMetrics(
  data: VendorDashboardResponse
): VendorAnalyticsMetrics {
  const lifecycle = data.lifecycleCounts;
  const completedJobs = count(
    lifecycle?.completed ?? data.recentJobs.filter((job) => job.status === "completed").length
  );
  const inProgressJobs = count(
    lifecycle?.inProgress ?? data.recentJobs.filter((job) => job.status === "in progress").length
  );
  const scheduledJobs = count(
    lifecycle?.scheduled ?? data.recentJobs.filter((job) => job.status === "scheduled").length
  );
  const awaitingReviewJobs = count(
    lifecycle?.awaitingReview ??
      data.recentJobs.filter((job) => job.status === "awaiting_review").length
  );
  const completionEligibleBookings = count(
    data.stats?.completionEligibleBookingCount ??
      completedJobs + inProgressJobs + scheduledJobs + awaitingReviewJobs
  );
  const ratingCount = count(data.stats?.ratingCount);

  return {
    totalBookings: count(data.stats?.totalBookings),
    totalClients: count(data.stats?.totalClients),
    rating: Math.min(5, nonNegativeNumber(data.stats?.rating)),
    ratingCount,
    approvedServiceOrders: count(
      data.approvedServiceOrderCount ?? data.approvedProofs ?? 0
    ),
    pendingServiceOrders: count(
      data.pendingModerationServiceOrderCount ?? data.pendingModerationProofs ?? 0
    ),
    archivedServiceOrders: count(
      lifecycle?.archived ?? data.archivedJobs?.length ?? 0
    ),
    totalProofAssets: count(data.totalProofAssets),
    storagePercent: percent(nonNegativeNumber(data.storagePercentUsed)),
    completedJobs,
    inProgressJobs,
    scheduledJobs,
    awaitingReviewJobs,
    completionRate:
      completionEligibleBookings > 0
        ? percent((completedJobs / completionEligibleBookings) * 100)
        : 0,
    verifiedRatingCoverage:
      completedJobs > 0 ? percent((ratingCount / completedJobs) * 100) : 0,
  };
}
