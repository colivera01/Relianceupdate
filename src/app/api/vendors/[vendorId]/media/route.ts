// src/app/api/vendors/[vendorId]/media/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: { vendorId: string };
}

/**
 * GET /api/vendors/[vendorId]/media
 * List all media assets for a vendor (vendor-scoped, excludes deleted)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = params;
    await requireVendorMembership(request, vendorId);

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const where: any = {
      vendorId,
    };

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const assets = await (prisma as any).mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        // Could include membership and device info if needed
      },
    });

    // Calculate total storage for this vendor (non-deleted only)
    const storageAggregate = await (prisma as any).mediaAsset.aggregate({
      where: {
        vendorId,
        deletedAt: null,
      },
      _sum: {
        bytes: true,
      },
    });

    const totalBytes = storageAggregate._sum.bytes || BigInt(0);

    return NextResponse.json({
      assets: assets.map((asset: any) => ({
        id: asset.id,
        vendorId: asset.vendorId,
        membershipId: asset.membershipId,
        deviceId: asset.deviceId,
        bytes: asset.bytes.toString(),
        mimeType: asset.mimeType,
        blobKey: asset.blobKey,
        blobUrl: asset.blobUrl,
        createdAt: asset.createdAt,
        deletedAt: asset.deletedAt,
      })),
      storage: {
        totalBytes: totalBytes.toString(),
        totalMB: (Number(totalBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("[media] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch media", details: error.message },
      { status: 500 }
    );
  }
}

