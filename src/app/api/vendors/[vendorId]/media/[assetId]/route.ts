// src/app/api/vendors/[vendorId]/media/[assetId]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: { vendorId: string; assetId: string };
}

/**
 * DELETE /api/vendors/[vendorId]/media/[assetId]
 * Soft delete a media asset (vendor-scoped)
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, assetId } = params;
    await requireVendorMembership(request, vendorId);

    // Find asset and verify it belongs to this vendor
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Media asset not found" },
        { status: 404 }
      );
    }

    if (asset.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden: Asset does not belong to this vendor" },
        { status: 403 }
      );
    }

    if (asset.deletedAt) {
      return NextResponse.json(
        { error: "Asset is already deleted" },
        { status: 422 }
      );
    }

    // Soft delete (always allowed, even if over limit)
    const updatedAsset = await (prisma as any).mediaAsset.update({
      where: { id: assetId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Recalculate storage (usage drops immediately since deletedAt IS NULL filter)
    const { calculateStorageUsage } = await import("@/lib/storage-helpers");
    const usage = await calculateStorageUsage(vendorId);

    return NextResponse.json({
      success: true,
      asset: {
        id: updatedAsset.id,
        deletedAt: updatedAsset.deletedAt,
      },
      storage: {
        usedBytes: usage.usedBytes.toString(),
        limitBytes: usage.limitBytes.toString(),
        percentUsed: usage.percentUsed,
        isOverLimit: usage.isOverLimit,
        totalMB: (Number(usage.usedBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(usage.usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("[media] DELETE error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete media", details: error.message },
      { status: 500 }
    );
  }
}

