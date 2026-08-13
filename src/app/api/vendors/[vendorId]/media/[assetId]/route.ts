// src/app/api/vendors/[vendorId]/media/[assetId]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { ARCHIVE_ACTIVE } from "@/lib/media-visibility";
import { requestMediaDeletion } from "@/lib/media-lifecycle";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import {
  assertServiceVideoStageMutationAllowed,
  REQUIRED_SERVICE_VIDEO_STAGES,
  type ServiceVideoStage,
} from "@/lib/service-video-evidence";
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
    const membership = await requireVendorMembership(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();

    if (action !== "RESTORE") {
      return NextResponse.json({ error: "Unsupported media action" }, { status: 422 });
    }

    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        vendorId: true,
        deletedAt: true,
        mediaSession: {
          select: {
            bookingId: true,
            sessionType: true,
            vendorJobVideoStage: true,
            capturedByMembershipId: true,
          },
        },
      },
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

    const stage = String(asset.mediaSession?.vendorJobVideoStage || "").trim().toUpperCase();
    const employeeServiceVideoRestore =
      String(membership.role || "").toUpperCase() === "EMPLOYEE" &&
      String(asset.mediaSession?.sessionType || "").toUpperCase() === "JOB_SERVICE_VIDEO";
    if (employeeServiceVideoRestore) {
      if (
        !asset.mediaSession?.bookingId ||
        !REQUIRED_SERVICE_VIDEO_STAGES.includes(stage as ServiceVideoStage) ||
        String(asset.mediaSession?.capturedByMembershipId || "") !== membership.membershipId
      ) {
        return NextResponse.json(
          { code: "EMPLOYEE_SERVICE_VIDEO_CONTEXT_INVALID", error: "This Service Video is not assigned to the current employee and stage." },
          { status: 403 },
        );
      }
      const booking = await prisma.booking.findFirst({
        where: { id: asset.mediaSession.bookingId, vendorId },
        select: { id: true, customerMetadata: true },
      });
      if (!booking) return NextResponse.json({ error: "Work record not found" }, { status: 404 });
      const gate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId: membership.membershipId,
        surface: "upload_status",
        capability: "record",
        actorKind: "EMPLOYEE",
        recordingStage: stage,
      });
      if (gate.blockCode) return NextResponse.json(recordingGateErrorBody(gate), { status: 409 });
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

    const restoreAsset = (db: any) => db.mediaAsset.update({
        where: { id: assetId },
        data: { deletedAt: null, archiveStatus: ARCHIVE_ACTIVE },
      });
    const updatedAsset = employeeServiceVideoRestore
      ? await prisma.$transaction(async (tx: any) => {
          await assertServiceVideoStageMutationAllowed(tx, {
            bookingId: asset.mediaSession!.bookingId!,
            vendorId,
            stage: stage as ServiceVideoStage,
          });
          return restoreAsset(tx);
        }, { isolationLevel: "Serializable" })
      : await restoreAsset(prisma as any);

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
    if (error?.name === "ServiceVideoMutationBlockedError") {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to update media", details: error.message },
      { status: 500 }
    );
  }
}

