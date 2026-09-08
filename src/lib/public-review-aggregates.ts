import {
  getVendorRatingStatsForVendors,
  type RatingDistributionEntry,
} from "@/lib/review-attribution-aggregates";

export interface VendorReviewAggregate {
  vendorId: string;
  rating: number | null;
  reviewCount: number;
  distribution?: RatingDistributionEntry[];
}

/**
 * Public-safe aggregation for reviews.
 *
 * Vendor stars are verified customer-rating evidence. Optional written content
 * remains subject to its separate public moderation contract.
 */
export async function getVendorReviewAggregatesForPublic(
  vendorIds: string[]
): Promise<Map<string, VendorReviewAggregate>> {
  const ids = Array.from(new Set(vendorIds.map((id) => String(id || "").trim()).filter(Boolean)));
  const result = new Map<string, VendorReviewAggregate>();

  if (ids.length === 0) {
    return result;
  }

  const statsByVendor = await getVendorRatingStatsForVendors(ids);
  for (const vendorId of ids) {
    const stats = statsByVendor.get(vendorId);
    if (!stats) continue;
    result.set(vendorId, {
      vendorId,
      rating: stats.reviewCount > 0 ? stats.averageRating : null,
      reviewCount: stats.reviewCount,
      distribution: stats.distribution,
    });
  }

  return result;
}
