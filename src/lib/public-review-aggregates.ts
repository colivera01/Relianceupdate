import { prisma } from "@/server/db";
import { countableReviewWhere } from "@/lib/metrics-exclusion";
import { canonicalVerifiedCustomerRatingWhere } from "@/lib/review-rating-validity";

export interface VendorReviewAggregate {
  vendorId: string;
  rating: number | null;
  reviewCount: number;
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

  const grouped = await prisma.review.groupBy({
    by: ["vendorId"],
    where: countableReviewWhere({
      vendorId: { in: ids },
      ...canonicalVerifiedCustomerRatingWhere(),
    }),
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  for (const row of grouped) {
    const rawAvg = row._avg.rating;
    result.set(row.vendorId, {
      vendorId: row.vendorId,
      rating: typeof rawAvg === "number" ? Number(rawAvg.toFixed(2)) : null,
      reviewCount: row._count._all || 0,
    });
  }

  return result;
}
