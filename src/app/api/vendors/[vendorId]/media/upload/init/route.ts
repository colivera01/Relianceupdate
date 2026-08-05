// src/app/api/vendors/[vendorId]/media/upload/init/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";
import { generateUploadUrl } from "@/lib/azure-blob-storage";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import {
  createUploadAttempt,
  normalizeCaptureProvenance,
  REQUIRED_SERVICE_VIDEO_STAGES,
  setUploadAttemptState,
  type ServiceVideoStage,
} from "@/lib/service-video-evidence";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/media/upload/init
 * Initialize media upload - returns SAS URL and blobKey
 * PRIMARY GATE: Blocks upload if storage limit would be exceeded
 */
export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const body = await request.json();
    const { fileName, expectedBytes, mimeType, deviceId, bookingId, mediaSessionId } = body;
    const tokenAccess = await resolveEmployeeCaptureAccess(request, {
      vendorId,
      bookingId: bookingId ? String(bookingId) : null,
    });
    const membership = tokenAccess || await requireVendorMembership(request, vendorId);

    let stagedUpload: {
      bookingId: string;
      mediaSessionId: string;
      membershipId: string;
      stage: ServiceVideoStage;
      captureProvenance: ReturnType<typeof normalizeCaptureProvenance>;
    } | null = null;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: String(bookingId), vendorId },
        select: { id: true, customerMetadata: true },
      });
      if (!booking) {
        return NextResponse.json({ error: "Invalid bookingId for this vendor" }, { status: 422 });
      }
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId: tokenAccess?.membershipId || membership.membershipId,
        surface: "upload_init",
        capability: "record",
        actorKind: tokenAccess ? "EMPLOYEE_LINK" : String((membership as any).role || "VENDOR_MEMBER"),
      });
      if (permissionGate.blockCode) {
        return NextResponse.json(recordingGateErrorBody(permissionGate), { status: 409 });
      }

      if (!mediaSessionId) {
        return NextResponse.json(
          { error: "mediaSessionId is required for a staged service-video upload" },
          { status: 422 }
        );
      }
      const membershipId = tokenAccess?.membershipId || membership.membershipId;
      const mediaSession = await (prisma as any).mediaSession.findFirst({
        where: {
          id: String(mediaSessionId),
          bookingId: booking.id,
          vendorId,
          sessionType: "JOB_SERVICE_VIDEO",
          capturedByMembershipId: membershipId,
          recordingGateDecisionId: { not: null },
        },
        select: { id: true, vendorJobVideoStage: true },
      });
      const stage = String(mediaSession?.vendorJobVideoStage || "").trim().toUpperCase();
      if (!mediaSession || !REQUIRED_SERVICE_VIDEO_STAGES.includes(stage as ServiceVideoStage)) {
        return NextResponse.json(
          { error: "The staged recording session is invalid or is not assigned to this employee." },
          { status: 409 }
        );
      }
      stagedUpload = {
        bookingId: booking.id,
        mediaSessionId: mediaSession.id,
        membershipId,
        stage: stage as ServiceVideoStage,
        captureProvenance: normalizeCaptureProvenance(body.captureProvenance),
      };
    }

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: "fileName and mimeType are required" },
        { status: 422 }
      );
    }

    if (!expectedBytes || expectedBytes <= 0) {
      return NextResponse.json(
        { error: "expectedBytes is required and must be greater than 0" },
        { status: 422 }
      );
    }

    // Calculate current storage usage
    const usage = await calculateStorageUsage(vendorId);

    // Check if adding expectedBytes would exceed limit
    const projectedUsed = usage.usedBytes + BigInt(expectedBytes);
    if (projectedUsed > usage.limitBytes) {
      // Check and create alerts (may have just crossed threshold)
      await checkAndCreateStorageAlerts(vendorId, usage);

      return NextResponse.json(
        {
          error: "STORAGE_LIMIT_REACHED",
          usedBytes: usage.usedBytes.toString(),
          limitBytes: usage.limitBytes.toString(),
          percentUsed: usage.percentUsed,
          message: "Storage limit reached. Delete existing media or upgrade your plan.",
        },
        { status: 403 }
      );
    }

    // Check and create alerts if thresholds crossed
    await checkAndCreateStorageAlerts(vendorId, usage);

    // Generate unique asset ID
    const assetId = crypto.randomBytes(16).toString("hex");
    
    // Extract file extension
    const ext = fileName.split(".").pop() || "";
    
    // Generate blob key with vendor prefix
    const blobKey = `vendor/${vendorId}/media/${assetId}.${ext}`;

    if (stagedUpload) {
      await createUploadAttempt({
        assetId,
        vendorId,
        bookingId: stagedUpload.bookingId,
        mediaSessionId: stagedUpload.mediaSessionId,
        membershipId: stagedUpload.membershipId,
        stage: stagedUpload.stage,
        captureProvenance: stagedUpload.captureProvenance,
        blobKey,
        expectedBytes: BigInt(expectedBytes),
        mimeType,
      });
    }

    // Generate SAS URL for Azure Blob Storage (60 minute expiration)
    let sasUrl: string;
    try {
      sasUrl = await generateUploadUrl(blobKey, 60);
    } catch (error: any) {
      if (stagedUpload) {
        await setUploadAttemptState({
          assetId,
          vendorId,
          state: "RETRY_REQUIRED",
          failureCode: "MEDIA_STORAGE_UNAVAILABLE",
          failureMessage: "Secure storage did not accept the upload initialization.",
        }).catch(() => undefined);
      }
      console.error("[media/upload/init] Storage unavailable", {
        vendorId,
        blobKey,
        message: error?.message || String(error),
      });
      return NextResponse.json(
        {
          code: "MEDIA_STORAGE_UNAVAILABLE",
          error:
            "Media upload is temporarily unavailable because secure storage is not configured or not reachable.",
          details: error?.message || String(error),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      assetId,
      blobKey,
      sasUrl,
      uploadUrl: sasUrl, // Alias for compatibility
      uploadState: stagedUpload ? "UPLOADING" : undefined,
      storage: {
        usedBytes: usage.usedBytes.toString(),
        limitBytes: usage.limitBytes.toString(),
        percentUsed: usage.percentUsed,
      },
    });
  } catch (error: any) {
    console.error("[media/upload/init] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to initialize upload", details: error.message },
      { status: 500 }
    );
  }
}
