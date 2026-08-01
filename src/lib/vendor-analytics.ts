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
  reviewCoverage: number;
};

export function deriveVendorAnalyticsMetrics(
  data: VendorDashboardResponse
): VendorAnalyticsMetrics {
  const lifecycle = data.lifecycleCounts;
  const completedJobs = Number(
    lifecycle?.completed ?? data.recentJobs.filter((job) => job.status === "completed").length
  );
  const inProgressJobs = Number(
    lifecycle?.inProgress ?? data.recentJobs.filter((job) => job.status === "in progress").length
  );
  const scheduledJobs = Number(
    lifecycle?.scheduled ?? data.recentJobs.filter((job) => job.status === "scheduled").length
  );
  const awaitingReviewJobs = Number(
    lifecycle?.awaitingReview ??
      data.recentJobs.filter((job) => job.status === "awaiting_review").length
  );
  const completionEligibleBookings = Number(
    data.stats?.completionEligibleBookingCount ??
      completedJobs + inProgressJobs + scheduledJobs + awaitingReviewJobs
  );
  const ratingCount = Number(data.stats?.ratingCount || 0);

  return {
    totalBookings: Number(data.stats?.totalBookings || 0),
    totalClients: Number(data.stats?.totalClients || 0),
    rating: Number(data.stats?.rating || 0),
    ratingCount,
    approvedServiceOrders: Number(
      data.approvedServiceOrderCount ?? data.approvedProofs ?? 0
    ),
    pendingServiceOrders: Number(
      data.pendingModerationServiceOrderCount ?? data.pendingModerationProofs ?? 0
    ),
    archivedServiceOrders: Number(
      lifecycle?.archived ?? data.archivedJobs?.length ?? 0
    ),
    totalProofAssets: Number(data.totalProofAssets || 0),
    storagePercent: Number(data.storagePercentUsed || 0),
    completedJobs,
    inProgressJobs,
    scheduledJobs,
    awaitingReviewJobs,
    completionRate:
      completionEligibleBookings > 0
        ? Math.round((completedJobs / completionEligibleBookings) * 100)
        : 0,
    reviewCoverage:
      completedJobs > 0 ? Math.min(100, Math.round((ratingCount / completedJobs) * 100)) : 0,
  };
}
