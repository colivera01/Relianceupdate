import { prisma } from "@/server/db";
import { countableReviewWhere } from "@/lib/metrics-exclusion";
import { canonicalVerifiedCustomerRatingWhere } from "@/lib/review-rating-validity";

type RatingStats = {
  averageRating: number;
  reviewCount: number;
  ratingSum: number;
};

const ELIGIBLE_REVIEW_WHERE = canonicalVerifiedCustomerRatingWhere();

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

