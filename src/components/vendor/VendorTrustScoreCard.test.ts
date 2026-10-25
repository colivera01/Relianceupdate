import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot } from './VendorTrustScoreCard';
import type { VendorDashboardResponse } from '@/types/vendor';

describe('buildDashboardSnapshot', () => {
  it('uses canonical lifecycle, Service Order, and verified-rating totals', () => {
    const dashboard = {
      profile: {},
      stats: {
        totalBookings: 14,
        totalEarnings: 0,
        totalClients: 1,
        rating: 4.5,
        ratingCount: 2,
        completionEligibleBookingCount: 8,
      },
      recentJobs: [
        { id: 'recent-only', status: 'completed' },
      ],
      archivedJobs: [],
      lifecycleCounts: {
        scheduled: 3,
        inProgress: 0,
        awaitingReview: 1,
        completed: 4,
        canceled: 2,
        archived: 4,
      },
      recentReviews: [],
      insights: [],
      notifications: [],
      pendingModerationProofs: 11,
      pendingModerationServiceOrderCount: 1,
      approvedProofAssets: 9,
      approvedServiceOrderCount: 3,
      archivedProofs: 14,
      totalProofAssets: 32,
      storagePercentUsed: 4,
    } as unknown as VendorDashboardResponse;

    expect(buildDashboardSnapshot(dashboard)).toMatchObject({
      totalBookings: 14,
      ratingCount: 2,
      approvedVideos: 3,
      pendingVideos: 1,
      archivedWorkRecords: 4,
      totalVideoAssets: 32,
      completedJobs: 4,
      scheduledJobs: 3,
      verifiedRatedServiceOrders: 2,
      ratingEligibleServiceOrders: 4,
      ratingParticipationPct: 50,
    });
  });
});
