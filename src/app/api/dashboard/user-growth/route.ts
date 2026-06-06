import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import {
  countableUserWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function buildMonthlyCounts(dates: Date[], year: number) {
  const counts = new Array(12).fill(0);

  for (const date of dates) {
    const normalizedDate = new Date(date);
    if (normalizedDate.getFullYear() !== year) continue;
    counts[normalizedDate.getMonth()] += 1;
  }

  return counts;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const startOfNextYear = new Date(currentYear + 1, 0, 1);

    const [users, vendors] = await Promise.all([
      prisma.user.findMany({
        where: countableUserWhere({
          createdAt: {
            gte: startOfYear,
            lt: startOfNextYear,
          },
        }),
        select: {
          createdAt: true,
        },
      }),
      prisma.vendor.findMany({
        where: countableVendorWhere({
          createdAt: {
            gte: startOfYear,
            lt: startOfNextYear,
          },
        }),
        select: {
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      labels: MONTH_LABELS,
      datasets: [
        {
          label: "New Customers",
          data: buildMonthlyCounts(
            users.map((user) => user.createdAt),
            currentYear
          ),
          borderColor: "#1D4ED8",
          backgroundColor: "rgba(29, 78, 216, 0.12)",
        },
        {
          label: "New Vendors",
          data: buildMonthlyCounts(
            vendors.map((vendor) => vendor.createdAt),
            currentYear
          ),
          borderColor: "#0F766E",
          backgroundColor: "rgba(15, 118, 110, 0.12)",
        },
      ],
      definitions: {
        newCustomers:
          "Countable customer registrations created in each month of the current year.",
        newVendors:
          "Countable vendor accounts created in each month of the current year.",
      },
      year: currentYear,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("User growth data error:", error);
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
      { error: "Failed to fetch user growth data" },
      { status: 500 }
    );
  }
}
