import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import {
  countableReviewWhere,
  countableUserWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";

function getMonthBounds(referenceDate = new Date()) {
  const startOfCurrentMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1
  );
  const startOfNextMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    1
  );
  const startOfPreviousMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - 1,
    1
  );

  return {
    startOfCurrentMonth,
    startOfNextMonth,
    startOfPreviousMonth,
  };
}

function calculateGrowthRate(currentCount: number, previousCount: number) {
  if (previousCount <= 0) {
    return currentCount > 0 ? 100 : 0;
  }

  return Math.round(((currentCount - previousCount) / previousCount) * 100);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { startOfCurrentMonth, startOfNextMonth, startOfPreviousMonth } =
      getMonthBounds();

    const [
      totalUsers,
      totalVendors,
      totalReviews,
      currentMonthUsers,
      previousMonthUsers,
    ] = await Promise.all([
      prisma.user.count({ where: countableUserWhere() }),
      prisma.vendor.count({ where: countableVendorWhere() }),
      prisma.review.count({ where: countableReviewWhere() }),
      prisma.user.count({
        where: countableUserWhere({
          createdAt: {
            gte: startOfCurrentMonth,
            lt: startOfNextMonth,
          },
        }),
      }),
      prisma.user.count({
        where: countableUserWhere({
          createdAt: {
            gte: startOfPreviousMonth,
            lt: startOfCurrentMonth,
          },
        }),
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalVendors,
      totalReviews,
      growthRate: calculateGrowthRate(currentMonthUsers, previousMonthUsers),
      growthRateDefinition:
        "Month-over-month change in countable customer registrations.",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    if (
      error.message === "Unauthorized" ||
      String(error.message).includes("Forbidden")
    ) {
      return NextResponse.json(
        { error: error.message || "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
