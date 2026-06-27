// src/app/api/vendors/[vendorId]/media/upload/complete/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";
import { downloadBlobToBuffer, getBlobProperties } from "@/lib/azure-blob-storage";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { STAGE_VIDEO_MAX_DURATION_SECONDS } from "@/lib/stage-video-guidance";
import { probeVideoDurationSecondsFromBuffer } from "@/lib/server-video-duration";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/media/upload/complete
 * Create MediaAsset record after blob upload is complete
 * SAFETY GATE: Re-checks limit before creating record
 */
export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const isDevelopment = process.env.NODE_ENV === "development";
    if (isDevelopment) {
      console.log("[media/upload/complete] HIT");
    }
    const { vendorId } = await context.params;

    const body = await request.json();
    const {
      assetId,
      blobKey,
      blobUrl,
      bytes,
      mimeType,
      deviceId,
      mediaSessionId,
      durationSeconds,
    } = body;
    const tokenAccess = await resolveEmployeeCaptureAccess(request, { vendorId });
    const membership = tokenAccess || (await requireVendorMembership(request, vendorId));
    const membershipId = membership.membershipId;

    if (!assetId || !blobKey || !bytes || !mimeType) {
      return NextResponse.json(
        { error: "assetId, blobKey, bytes, and mimeType are required" },
        { status: 422 }
      );
    }

    // Verify blob exists and get actual size (safety check)
    let actualBytes = BigInt(bytes);
    let blobValidationWarning: string | null = null;
    try {
      if (isDevelopment) {
        console.log("[media/upload/complete] blob verification start", {
          vendorId,
          assetId,
          blobKey,
        });
      }
      const blobProps = await getBlobProperties(blobKey);
      if (isDevelopment) {
        console.log("[media/upload/complete] blob verification result", {
          exists: Boolean(blobProps?.exists),
          contentLength: blobProps?.contentLength ?? null,
          contentType: blobProps?.contentType ?? null,
        });
      }
      if (blobProps && blobProps.exists && blobProps.contentLength) {
        // Use actual blob size if available (more accurate)
        actualBytes = BigInt(blobProps.contentLength);
      } else if (!blobProps || !blobProps.exists) {
        blobValidationWarning =
          "Blob was not found in storage during upload completion. Metadata was saved, but playback may fail.";
      } else if ((blobProps.contentLength ?? 0) <= 0) {
        blobValidationWarning =
          "Blob exists but has zero bytes during upload completion. Playback may show 0:00.";
      }
    } catch (error: any) {
      console.warn("Could not verify blob properties, using provided bytes:", error.message);
      // Continue with provided bytes if blob verification fails
    }
    if (blobValidationWarning) {
      console.warn("[media/upload/complete] Blob validation warning", {
        vendorId,
        assetId,
        blobKey,
        warning: blobValidationWarning,
      });
    }

    // SAFETY GATE: Recalculate storage and check limit
    const usage = await calculateStorageUsage(vendorId);
    const projectedUsed = usage.usedBytes + actualBytes;
    
    if (projectedUsed > usage.limitBytes) {
      // Check and create alerts
      await checkAndCreateStorageAlerts(vendorId, usage);

      return NextResponse.json(
        {
          error: "STORAGE_LIMIT_REACHED",
          usedBytes: usage.usedBytes.toString(),
          limitBytes: usage.limitBytes.toString(),
          percentUsed: usage.percentUsed,
          message: "Storage limit would be exceeded. Upload blocked.",
        },
        { status: 403 }
      );
    }

    // Optional media session linkage (must be vendor-scoped)
    let validMediaSessionId: string | null = null;
    if (mediaSessionId) {
      const session = await (prisma as any).mediaSession.findFirst({
        where: {
          id: mediaSessionId,
          vendorId,
        },
        select: { id: true, bookingId: true, vendorJobVideoStage: true, sessionType: true },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Invalid mediaSessionId for this vendor" },
          { status: 422 }
        );
      }
      if (tokenAccess && String(session.bookingId || "") !== tokenAccess.bookingId) {
        return NextResponse.json(
          {
            error: "JOB_CAPTURE_TOKEN_FORBIDDEN",
            message: "This capture link is not authorized for this media session.",
          },
          { status: 403 }
        );
      }
      const isStagedJobVideo =
        Boolean(String(session.vendorJobVideoStage || "").trim()) ||
        String(session.sessionType || "").trim().toUpperCase() === "JOB_SERVICE_VIDEO";
      if (isStagedJobVideo) {
        if (!String(mimeType || "").toLowerCase().startsWith("video/")) {
          return NextResponse.json(
            {
              error: "STAGE_VIDEO_MIME_TYPE_REQUIRED",
              message: "Stage uploads must be video files.",
            },
            { status: 422 }
          );
        }

        const declaredDurationSeconds = Number(durationSeconds);
        if (!Number.isFinite(declaredDurationSeconds) || declaredDurationSeconds <= 0) {
          return NextResponse.json(
            {
              error: "STAGE_VIDEO_DURATION_REQUIRED",
              message: "Stage video uploads must include a readable duration so the 30-second limit can be enforced.",
            },
            { status: 422 }
          );
        }
        if (declaredDurationSeconds > STAGE_VIDEO_MAX_DURATION_SECONDS) {
          return NextResponse.json(
            {
              error: "STAGE_VIDEO_TOO_LONG",
              message: `Stage videos must be ${STAGE_VIDEO_MAX_DURATION_SECONDS} seconds or less.`,
              maxDurationSeconds: STAGE_VIDEO_MAX_DURATION_SECONDS,
              durationSeconds: declaredDurationSeconds,
            },
            { status: 413 }
          );
        }

        let verifiedDurationSeconds: number;
        try {
          const uploadedVideo = await downloadBlobToBuffer(blobKey);
          verifiedDurationSeconds = probeVideoDurationSecondsFromBuffer(uploadedVideo, mimeType);
        } catch (error: any) {
          console.warn("[media/upload/complete] Stage video duration probe failed", {
            vendorId,
            assetId,
            blobKey,
            message: error?.message || String(error),
          });
          return NextResponse.json(
            {
              error: "STAGE_VIDEO_DURATION_UNVERIFIABLE",
              message:
                "Stage video duration could not be verified from the uploaded media. Please retry with a supported video file.",
            },
            { status: 422 }
          );
        }

        if (verifiedDurationSeconds > STAGE_VIDEO_MAX_DURATION_SECONDS) {
          return NextResponse.json(
            {
              error: "STAGE_VIDEO_TOO_LONG",
              message: `Stage videos must be ${STAGE_VIDEO_MAX_DURATION_SECONDS} seconds or less.`,
              maxDurationSeconds: STAGE_VIDEO_MAX_DURATION_SECONDS,
              durationSeconds: verifiedDurationSeconds,
              declaredDurationSeconds,
              verifiedByServer: true,
            },
            { status: 413 }
          );
        }
      }
      validMediaSessionId = session.id;
    }

    if (isDevelopment) {
      console.log("[media/upload/complete] prisma.mediaAsset.create payload summary", {
        vendorId,
        assetId,
        mediaSessionId: validMediaSessionId,
        membershipId: membershipId || null,
        uploadedByMembershipId: membershipId || null,
        deviceId: deviceId || null,
        bytes: actualBytes.toString(),
        mimeType,
        blobKey,
        hasBlobUrl: Boolean(blobUrl),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
      });
    }

    // Create MediaAsset record
    const asset = await (prisma as any).mediaAsset.create({
      data: {
        id: assetId,
        vendorId,
        mediaSessionId: validMediaSessionId,
        membershipId: membershipId || null,
        uploadedByMembershipId: membershipId || null,
        deviceId: deviceId || null,
        bytes: actualBytes,
        mimeType,
        blobKey,
        blobUrl: blobUrl || null,
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
        deletedAt: null,
      },
    });

    // Recalculate storage after creation
    const updatedUsage = await calculateStorageUsage(vendorId);
    
    // Check and create alerts (may have crossed threshold after upload)
    await checkAndCreateStorageAlerts(vendorId, updatedUsage);

    // Vendor workflow: all 3 required staged videos move job to AWAITING_ADMIN_REVIEW.
    if (validMediaSessionId && String(mimeType || "").toLowerCase().startsWith("video/")) {
      try {
        const sessionRow = await (prisma as any).mediaSession.findFirst({
          where: { id: validMediaSessionId, vendorId },
          select: { bookingId: true },
        });
        const bookingId = sessionRow?.bookingId ? String(sessionRow.bookingId) : null;
        if (bookingId) {
          const bookingRow = await prisma.booking.findFirst({
            where: { id: bookingId, vendorId },
            select: { id: true, status: true, customerMetadata: true },
          });
          const st = String(bookingRow?.status || "")
            .trim()
            .toUpperCase();
          if (bookingRow && ["PENDING", "CONFIRMED", "IN_PROGRESS", "AWAITING_REVIEW"].includes(st)) {
            const sessions = await (prisma as any).mediaSession.findMany({
              where: { vendorId, bookingId },
              select: {
                id: true,
                vendorJobVideoStage: true,
                sessionType: true,
                mediaAssets: {
                  select: { id: true, moderationStatus: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            });
            const packageState = evaluateVendorJobPackageState(sessions);
            const hasAllRequiredStages = packageState.hasAllRequiredStages;
            const nextMeta = setOperationalPhaseOnMetadataJson(bookingRow.customerMetadata, "IN_PROGRESS");
            await prisma.booking.update({
              where: { id: bookingRow.id },
              data: { customerMetadata: nextMeta },
            });
          }
        }
      } catch (phaseErr: any) {
        console.warn("[media/upload/complete] operational phase update skipped:", phaseErr?.message || phaseErr);
      }
    }

    return NextResponse.json({
      success: true,
      warning: blobValidationWarning,
      asset: {
        id: asset.id,
        vendorId: asset.vendorId,
        mediaSessionId: asset.mediaSessionId,
        blobKey: asset.blobKey,
        blobUrl: asset.blobUrl,
        bytes: asset.bytes.toString(),
        mimeType: asset.mimeType,
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        archiveStatus: asset.archiveStatus,
        createdAt: asset.createdAt,
      },
      storage: {
        usedBytes: updatedUsage.usedBytes.toString(),
        limitBytes: updatedUsage.limitBytes.toString(),
        percentUsed: updatedUsage.percentUsed,
        totalMB: (Number(updatedUsage.usedBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(updatedUsage.usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("[media/upload/complete] POST error:", error);
    if (process.env.NODE_ENV === "development") {
      console.error("[media/upload/complete] POST error details", {
        message: error?.message || null,
        code: error?.code || null,
        name: error?.name || null,
        meta: error?.meta || null,
        stack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : null,
      });
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Asset ID already exists" },
        { status: 409 }
      );
    }
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      process.env.NODE_ENV === "development"
        ? {
            error: "Failed to complete upload",
            details: error?.message || "Unknown error",
            code: error?.code || null,
            meta: error?.meta || null,
          }
        : { error: "Failed to complete upload", details: error.message },
      { status: 500 }
    );
  }
}
