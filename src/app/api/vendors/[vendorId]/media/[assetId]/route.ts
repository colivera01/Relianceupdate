// src/app/api/vendors/[vendorId]/media/[assetId]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { ARCHIVE_ACTIVE } from "@/lib/media-visibility";
import { requestMediaDeletion } from "@/lib/media-lifecycle";
import {
  authorizationErrorResponse,
  requireActorVendorManager,
  requireRequestActor,
} from "@/lib/request-actor";

interface RouteParams {
  params: Promise<{ vendorId: string; assetId: string }>;
}

/**
 * DELETE /api/vendors/[vendorId]/media/[assetId]
 * Request deletion of a media asset (vendor-manager scoped).
 * Physical deletion is completed only by the lifecycle worker after blob
 * absence is independently verified.
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, assetId } = await params;
    const actor = await requireRequestActor(request);
    requireActorVendorManager(actor, vendorId);

    // Find asset and verify it belongs to this vendor
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      include: { mediaSession: { select: { bookingId: true } } },
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

    if (asset.deletedAt || !asset.mediaSession?.bookingId) {
      return NextResponse.json(
        { error: asset.deletedAt ? "Asset is already archived or deleted" : "This media is not connected to a work record and requires admin review." },
        { status: 422 }
      );
    }

    const deletion = await requestMediaDeletion({
      bookingId: asset.mediaSession.bookingId,
      vendorId,
      mediaAssetId: assetId,
      actorUserId: actor.userId,
      actorRole: "VENDOR_MANAGER",
      reason: "Vendor manager requested media deletion.",
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Deletion requested. Access is restricted, but the media is not deleted until Reliance verifies that the stored file is absent.",
      deletion,
    });
  } catch (error: any) {
    console.error("[media] DELETE error:", error);
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
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

    const lifecycleDeletion = await (prisma as any).mediaDeletionRequest?.findFirst?.({
      where: { mediaAssetId: assetId, status: { notIn: ["DENIED"] } },
      orderBy: { requestedAt: "desc" },
    });
    if (lifecycleDeletion) {
      return NextResponse.json(
        { error: "This asset has a lifecycle deletion record and cannot be restored through the legacy archive action." },
        { status: 409 },
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

