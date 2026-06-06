// src/app/api/vendors/[vendorId]/media/storage/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { countableMediaAssetWhere } from "@/lib/metrics-exclusion";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/media/storage
 * Get storage usage for a vendor (only non-deleted assets)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await params;
    await requireVendorMembership(request, vendorId);

    // Calculate storage usage (SUM(bytes) WHERE vendorId = X AND deletedAt IS NULL)
    const storageAggregate = await (prisma as any).mediaAsset.aggregate({
      where: countableMediaAssetWhere({ vendorId }),
      _sum: {
        bytes: true,
      },
      _count: {
        id: true,
      },
    });

    const totalBytes = storageAggregate._sum.bytes || BigInt(0);
    const assetCount = storageAggregate._count.id || 0;

    return NextResponse.json({
      vendorId,
      storage: {
        totalBytes: totalBytes.toString(),
        totalMB: (Number(totalBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
        assetCount,
      },
    });
  } catch (error: any) {
    console.error("[media/storage] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch storage", details: error.message },
      { status: 500 }
    );
  }
}

