// src/app/api/vendors/[vendorId]/storage/usage/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/storage/usage
 * Get storage usage for a vendor (usedBytes, limitBytes, percentUsed)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await params;
    await requireVendorMembership(request, vendorId);

    // Calculate storage usage
    const usage = await calculateStorageUsage(vendorId);

    // Check and create alerts if thresholds crossed
    await checkAndCreateStorageAlerts(vendorId, usage);

    // Optional: Get breakdown by mimeType
    const breakdown = await (prisma as any).mediaAsset.groupBy({
      by: ["mimeType"],
      where: {
        vendorId,
        deletedAt: null,
      },
      _sum: {
        bytes: true,
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      vendorId,
      storage: {
        usedBytes: usage.usedBytes.toString(),
        limitBytes: usage.limitBytes.toString(),
        percentUsed: usage.percentUsed,
        isOverLimit: usage.isOverLimit,
        totalMB: (Number(usage.usedBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(usage.usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
        limitMB: (Number(usage.limitBytes) / (1024 * 1024)).toFixed(2),
        limitGB: (Number(usage.limitBytes) / (1024 * 1024 * 1024)).toFixed(2),
      },
      breakdown: breakdown.map((item: any) => ({
        mimeType: item.mimeType,
        bytes: item._sum.bytes.toString(),
        count: item._count.id,
      })),
    });
  } catch (error: any) {
    console.error("[storage/usage] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch storage usage", details: error.message },
      { status: 500 }
    );
  }
}

