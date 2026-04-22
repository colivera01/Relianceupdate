// src/app/api/vendors/[vendorId]/media/[assetId]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { ARCHIVE_ACTIVE, ARCHIVE_ARCHIVED } from "@/lib/media-visibility";

interface RouteParams {
  params: Promise<{ vendorId: string; assetId: string }>;
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
    const { vendorId, assetId } = await params;
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
        archiveStatus: ARCHIVE_ARCHIVED,
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

/**
 * PATCH /api/vendors/[vendorId]/media/[assetId]
 * Restore or update archive state for a media asset (vendor-scoped)
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, assetId } = await params;
    await requireVendorMembership(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();

    if (action !== "RESTORE") {
      return NextResponse.json({ error: "Unsupported media action" }, { status: 422 });
    }

    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      select: { id: true, vendorId: true, deletedAt: true },
    });

    if (!asset) {
      return NextResponse.json({ error: "Media asset not found" }, { status: 404 });
    }

    if (asset.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden: Asset does not belong to this vendor" },
        { status: 403 }
      );
    }

    if (!asset.deletedAt) {
      return NextResponse.json(
        { success: true, message: "Asset is already active", asset: { id: asset.id, deletedAt: null } },
        { status: 200 }
      );
    }

    const updatedAsset = await (prisma as any).mediaAsset.update({
      where: { id: assetId },
      data: { deletedAt: null, archiveStatus: ARCHIVE_ACTIVE },
    });

    return NextResponse.json({
      success: true,
      message: "Media asset restored successfully",
      asset: {
        id: updatedAsset.id,
        deletedAt: updatedAsset.deletedAt,
      },
    });
  } catch (error: any) {
    console.error("[media] PATCH error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update media", details: error.message },
      { status: 500 }
    );
  }
}

