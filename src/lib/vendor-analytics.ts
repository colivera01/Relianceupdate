import type { VendorDashboardResponse, VendorReview } from "@/types/vendor";

type EmployeePerformanceRow = NonNullable<VendorDashboardResponse["employeePerformance"]>[number];

export type VendorAnalyticsMetrics = {
  totalBookings: number;
  totalClients: number;
  rating: number;
  ratingCount: number;
  approvedServiceOrders: number;
  publicServiceOrders: number;
  pendingServiceOrders: number;
  archivedJobs: number;
  totalProofAssets: number;
  storagePercent: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  completedJobs: number;
  inProgressJobs: number;
  scheduledJobs: number;
  awaitingReviewJobs: number;
  canceledJobs: number;
  rejectedJobs: number;
  statusTotal: number;
  unclassifiedJobs: number;
  statusCountMatchesTotal: boolean;
  completionRate: number;
  verifiedRatingCoverage: number;
  ratingCoverageNumerator: number;
  ratingCoverageDenominator: number;
};

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function count(value: unknown): number {
  return Math.floor(nonNegativeNumber(value));
}

function percent(value: number, precision = 0): number {
  const multiplier = 10 ** precision;
  return Math.max(0, Math.min(100, Math.round(value * multiplier) / multiplier));
}

function safeBytes(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function selectTopRatedTeamMember(
  rows: VendorDashboardResponse["employeePerformance"]
): EmployeePerformanceRow | null {
  return (
    [...(rows || [])]
      .filter((row) => {
        const rating = Number(row.averageRating);
        return Number(row.reviewCount) > 0 && rating >= 1 && rating <= 5;
      })
      .sort(
        (a, b) =>
          Number(b.averageRating) - Number(a.averageRating) ||
          Number(b.reviewCount) - Number(a.reviewCount) ||
          String(a.displayName || "").localeCompare(String(b.displayName || "")) ||
          String(a.membershipId || "").localeCompare(String(b.membershipId || ""))
      )[0] || null
  );
}

export function selectMostRecentPublicReview(rows: VendorReview[]): VendorReview | null {
  return (
    [...(rows || [])]
      .filter((review) => {
        const timestamp = new Date(review.date).getTime();
        return Boolean(String(review.comment || "").trim()) && Number.isFinite(timestamp);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null
  );
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
  const canceledJobs = count(
    lifecycle?.canceled ?? data.recentJobs.filter((job) => job.status === "canceled").length
  );
  const rejectedJobs = count(lifecycle?.rejected ?? 0);
  const archivedJobs = count(lifecycle?.archived ?? data.archivedJobs?.length ?? 0);
  const statusTotal =
    scheduledJobs +
    inProgressJobs +
    awaitingReviewJobs +
    completedJobs +
    canceledJobs +
    rejectedJobs +
    archivedJobs;
  const completionEligibleBookings = count(
    data.stats?.completionEligibleBookingCount ??
      completedJobs + inProgressJobs + scheduledJobs + awaitingReviewJobs
  );
  const ratingCount = count(data.stats?.ratingCount);
  const totalBookings = count(data.stats?.totalBookings);
  const ratingCoverageDenominator = count(
    data.stats?.ratingEligibleServiceOrderCount ?? completedJobs
  );
  const ratingCoverageNumerator = Math.min(
    ratingCoverageDenominator,
    count(data.stats?.verifiedRatedServiceOrderCount ?? ratingCount)
  );
  const storageUsedBytes = safeBytes(data.storageUsedBytes);
  const storageLimitBytes = safeBytes(data.storageLimitBytes);
  const exactStoragePercent =
    storageLimitBytes > 0
      ? (storageUsedBytes / storageLimitBytes) * 100
      : nonNegativeNumber(data.storagePercentUsed);

  return {
    totalBookings,
    totalClients: count(data.stats?.totalClients),
    rating: Math.min(5, nonNegativeNumber(data.stats?.rating)),
    ratingCount,
    approvedServiceOrders: count(
      data.approvedServiceOrderCount ?? data.approvedProofs ?? 0
    ),
    publicServiceOrders: count(data.publicServiceOrderCount),
    pendingServiceOrders: count(
      data.pendingModerationServiceOrderCount ?? data.pendingModerationProofs ?? 0
    ),
    archivedJobs,
    totalProofAssets: count(data.totalProofAssets),
    storagePercent: percent(exactStoragePercent, 2),
    storageUsedBytes,
    storageLimitBytes,
    completedJobs,
    inProgressJobs,
    scheduledJobs,
    awaitingReviewJobs,
    canceledJobs,
    rejectedJobs,
    statusTotal,
    unclassifiedJobs: Math.max(0, totalBookings - statusTotal),
    statusCountMatchesTotal: statusTotal === totalBookings,
    completionRate:
      completionEligibleBookings > 0
        ? percent((completedJobs / completionEligibleBookings) * 100)
        : 0,
    verifiedRatingCoverage:
      ratingCoverageDenominator > 0
        ? percent((ratingCoverageNumerator / ratingCoverageDenominator) * 100)
        : 0,
    ratingCoverageNumerator,
    ratingCoverageDenominator,
  };
}
