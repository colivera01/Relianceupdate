import { prisma } from "@/server/db";
import { countableReviewWhere } from "@/lib/metrics-exclusion";
import { canonicalVerifiedCustomerRatingWhere } from "@/lib/review-rating-validity";

export type RatingDistributionEntry = {
  rating: 1 | 2 | 3 | 4 | 5;
  count: number;
  percentage: number;
};

export type RatingStats = {
  averageRating: number;
  reviewCount: number;
  ratingSum: number;
};

export type VendorRatingStats = RatingStats & {
  distribution: RatingDistributionEntry[];
};

const ELIGIBLE_REVIEW_WHERE = canonicalVerifiedCustomerRatingWhere();

function normalizeRating(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyDistribution(): RatingDistributionEntry[] {
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating: rating as RatingDistributionEntry["rating"],
    count: 0,
    percentage: 0,
  }));
}

function emptyRatingStats(): RatingStats {
  return { averageRating: 0, reviewCount: 0, ratingSum: 0 };
}

function emptyVendorRatingStats(): VendorRatingStats {
  return {
    ...emptyRatingStats(),
    distribution: emptyDistribution(),
  };
}

function toStatsFromRatingCounts(rows: Array<{ rating: number; count: number }>): VendorRatingStats {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const rating = normalizeRating(row.rating);
    const count = Math.max(0, Number(row.count || 0));
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5 && count > 0) {
      counts.set(rating, (counts.get(rating) || 0) + count);
    }
  }
  const ratingSum = Array.from(counts.entries()).reduce(
    (sum, [rating, count]) => sum + rating * count,
    0
  );
  const reviewCount = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const averageRating = reviewCount > 0 ? roundToOneDecimal(ratingSum / reviewCount) : 0;
  const distribution = emptyDistribution().map((entry) => {
    const count = counts.get(entry.rating) || 0;
    return {
      ...entry,
      count,
      percentage: reviewCount > 0 ? roundToOneDecimal((count / reviewCount) * 100) : 0,
    };
  });
  return { averageRating, reviewCount, ratingSum, distribution };
}

function toStatsFromRows(rows: Array<{ rating: number }>): RatingStats {
  const ratingSum = rows.reduce((sum, row) => sum + normalizeRating(row.rating), 0);
  const reviewCount = rows.length;
  const averageRating = reviewCount > 0 ? roundToOneDecimal(ratingSum / reviewCount) : 0;
  return { averageRating, reviewCount, ratingSum };
}

export async function getVendorRatingStatsForVendors(
  vendorIds: string[]
): Promise<Map<string, VendorRatingStats>> {
  const ids = Array.from(new Set(vendorIds.map((id) => String(id || "").trim()).filter(Boolean)));
  const result = new Map<string, VendorRatingStats>();
  if (ids.length === 0) return result;

  const grouped = await prisma.review.groupBy({
    by: ["vendorId", "rating"],
    where: countableReviewWhere({
      vendorId: { in: ids },
      ...ELIGIBLE_REVIEW_WHERE,
    }),
    _count: { _all: true },
  });

  const rowsByVendor = new Map<string, Array<{ rating: number; count: number }>>();
  for (const row of grouped) {
    const rows = rowsByVendor.get(row.vendorId) || [];
    rows.push({ rating: row.rating, count: row._count._all || 0 });
    rowsByVendor.set(row.vendorId, rows);
  }
  for (const vendorId of ids) {
    result.set(vendorId, toStatsFromRatingCounts(rowsByVendor.get(vendorId) || []));
  }
  return result;
}

export async function getVendorRatingStats(vendorId: string): Promise<VendorRatingStats> {
  try {
    const stats = await getVendorRatingStatsForVendors([vendorId]);
    return stats.get(vendorId) || emptyVendorRatingStats();
  } catch {
    return emptyVendorRatingStats();
  }
}

export async function getEmployeeRatingStats(
  vendorId: string,
  membershipId: string
): Promise<RatingStats> {
  const normalizedMembershipId = String(membershipId || "").trim();
  if (!normalizedMembershipId) {
    return emptyRatingStats();
  }
  try {
    const [legacyRows, employeeRows] = await Promise.all([
      (prisma as any).review.findMany({
        where: countableReviewWhere({
          vendorId,
          assignedMembershipId: normalizedMembershipId,
          attributionVersion: { lt: 3 },
          ...ELIGIBLE_REVIEW_WHERE,
        }),
        select: { rating: true },
      }),
      (prisma as any).employeeCustomerRatingEvidence.findMany({
        where: {
          vendorId,
          employeeMembershipId: normalizedMembershipId,
          review: { is: countableReviewWhere(ELIGIBLE_REVIEW_WHERE) },
        },
        select: { rating: true },
      }),
    ]);
    return toStatsFromRows([...legacyRows, ...employeeRows]);
  } catch {
    return emptyRatingStats();
  }
}

export async function getEmployeeRatingsForVendor(
  vendorId: string,
  membershipIds?: string[]
): Promise<
  Array<{
    membershipId: string;
    averageRating: number;
    reviewCount: number;
    ratingSum: number;
  }>
> {
  const normalizedIds = Array.isArray(membershipIds)
    ? Array.from(new Set(membershipIds.map((id) => String(id || "").trim()).filter(Boolean)))
    : null;

  const legacyWhere: any = countableReviewWhere({
          vendorId,
          ...ELIGIBLE_REVIEW_WHERE,
          assignedMembershipId: { not: null },
    attributionVersion: { lt: 3 },
  });
  if (normalizedIds && normalizedIds.length > 0) {
    legacyWhere.assignedMembershipId = { in: normalizedIds };
  }

  let legacyRows: Array<{ assignedMembershipId: string | null; rating: number }> = [];
  let employeeRows: Array<{ employeeMembershipId: string; rating: number }> = [];
  try {
    [legacyRows, employeeRows] = await Promise.all([
      (prisma as any).review.findMany({
        where: legacyWhere,
        select: {
          assignedMembershipId: true,
          rating: true,
        },
      }),
      (prisma as any).employeeCustomerRatingEvidence.findMany({
        where: {
          vendorId,
          ...(normalizedIds && normalizedIds.length > 0
            ? { employeeMembershipId: { in: normalizedIds } }
            : {}),
          review: { is: countableReviewWhere(ELIGIBLE_REVIEW_WHERE) },
        },
        select: {
          employeeMembershipId: true,
          rating: true,
        },
      }),
    ]);
  } catch {
    return [];
  }

  const byMembershipId = new Map<string, Array<{ rating: number }>>();
  for (const row of legacyRows) {
    const membershipId = String(row.assignedMembershipId || "").trim();
    if (!membershipId) continue;
    const list = byMembershipId.get(membershipId) || [];
    list.push({ rating: normalizeRating(row.rating) });
    byMembershipId.set(membershipId, list);
  }
  for (const row of employeeRows) {
    const membershipId = String(row.employeeMembershipId || "").trim();
    if (!membershipId) continue;
    const list = byMembershipId.get(membershipId) || [];
    list.push({ rating: normalizeRating(row.rating) });
    byMembershipId.set(membershipId, list);
  }

  return Array.from(byMembershipId.entries()).map(([membershipId, reviewRows]) => {
    const stats = toStatsFromRows(reviewRows);
    return {
      membershipId,
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
      ratingSum: stats.ratingSum,
    };
  });
}

