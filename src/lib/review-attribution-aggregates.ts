import { prisma } from "@/server/db";
import { countableReviewWhere } from "@/lib/metrics-exclusion";

type RatingStats = {
  averageRating: number;
  reviewCount: number;
  ratingSum: number;
};

const ELIGIBLE_REVIEW_WHERE = {
  source: "customer",
  moderationStatus: "approved",
  bookingId: { not: null as string | null },
};

function normalizeRating(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toStatsFromRows(rows: Array<{ rating: number }>): RatingStats {
  const ratingSum = rows.reduce((sum, row) => sum + normalizeRating(row.rating), 0);
  const reviewCount = rows.length;
  const averageRating = reviewCount > 0 ? roundToOneDecimal(ratingSum / reviewCount) : 0;
  return { averageRating, reviewCount, ratingSum };
}

export async function getVendorRatingStats(vendorId: string): Promise<RatingStats> {
  try {
    const rows = await prisma.review.findMany({
      where: countableReviewWhere({
        vendorId,
        ...ELIGIBLE_REVIEW_WHERE,
      }),
      select: { rating: true },
    });
    return toStatsFromRows(rows);
  } catch {
    return { averageRating: 0, reviewCount: 0, ratingSum: 0 };
  }
}

export async function getEmployeeRatingStats(
  vendorId: string,
  membershipId: string
): Promise<RatingStats> {
  const normalizedMembershipId = String(membershipId || "").trim();
  if (!normalizedMembershipId) {
    return { averageRating: 0, reviewCount: 0, ratingSum: 0 };
  }
  try {
    const rows = await (prisma as any).review.findMany({
      where: countableReviewWhere({
        vendorId,
        assignedMembershipId: normalizedMembershipId,
        ...ELIGIBLE_REVIEW_WHERE,
      }),
      select: { rating: true },
    });
    return toStatsFromRows(rows);
  } catch {
    return { averageRating: 0, reviewCount: 0, ratingSum: 0 };
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

  const where: any = countableReviewWhere({
    vendorId,
    ...ELIGIBLE_REVIEW_WHERE,
    assignedMembershipId: { not: null },
  });
  if (normalizedIds && normalizedIds.length > 0) {
    where.assignedMembershipId = { in: normalizedIds };
  }

  let rows: Array<{ assignedMembershipId: string | null; rating: number }> = [];
  try {
    rows = await (prisma as any).review.findMany({
      where,
      select: {
        assignedMembershipId: true,
        rating: true,
      },
    });
  } catch {
    return [];
  }

  const byMembershipId = new Map<string, Array<{ rating: number }>>();
  for (const row of rows) {
    const membershipId = String(row.assignedMembershipId || "").trim();
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

