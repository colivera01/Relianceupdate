import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";
import { downloadBlobToBuffer, getBlobProperties } from "@/lib/azure-blob-storage";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { STAGE_VIDEO_MAX_DURATION_SECONDS } from "@/lib/stage-video-guidance";
import { probeVideoDurationSecondsFromBuffer } from "@/lib/server-video-duration";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import {
  REQUIRED_SERVICE_VIDEO_STAGES,
  saveVerifiedServiceVideoStage,
  setUploadAttemptState,
  type CaptureProvenance,
  type ServiceVideoStage,
  type TruthfulUploadState,
} from "@/lib/service-video-evidence";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

async function failStagedUpload(input: {
  assetId: string;
  vendorId: string;
  state: Extract<TruthfulUploadState, "RETRY_REQUIRED" | "REJECTED">;
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}) {
  await setUploadAttemptState({
    assetId: input.assetId,
    vendorId: input.vendorId,
    state: input.state,
    failureCode: input.code,
    failureMessage: input.message,
  }).catch(() => undefined);
  return NextResponse.json(
    {
      error: input.code,
      message: input.message,
      uploadState: input.state,
      ...input.details,
    },
    { status: input.status }
  );
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
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

    const session = mediaSessionId
      ? await (prisma as any).mediaSession.findFirst({
          where: { id: String(mediaSessionId), vendorId },
          select: {
            id: true,
            bookingId: true,
            vendorJobVideoStage: true,
            sessionType: true,
            recordingGateDecisionId: true,
            capturedByMembershipId: true,
          },
        })
      : null;
    if (mediaSessionId && !session) {
      return NextResponse.json({ error: "Invalid mediaSessionId for this vendor" }, { status: 422 });
    }

    const stageValue = String(session?.vendorJobVideoStage || "").trim().toUpperCase();
    const isStaged = Boolean(
      session &&
        (REQUIRED_SERVICE_VIDEO_STAGES.includes(stageValue as ServiceVideoStage) ||
          String(session.sessionType || "").trim().toUpperCase() === "JOB_SERVICE_VIDEO")
    );

    if (isStaged) {
      if (!session.bookingId || !REQUIRED_SERVICE_VIDEO_STAGES.includes(stageValue as ServiceVideoStage)) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_SESSION_EVIDENCE_INVALID",
          message: "This recording session is missing its work-record stage evidence.",
          status: 409,
        });
      }
      if (String(session.capturedByMembershipId || "") !== String(membershipId)) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_SESSION_EMPLOYEE_MISMATCH",
          message: "This upload does not belong to the employee who opened the recording session.",
          status: 403,
        });
      }
      if (tokenAccess && String(session.bookingId) !== tokenAccess.bookingId) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "JOB_CAPTURE_TOKEN_FORBIDDEN",
          message: "This capture link is not authorized for this media session.",
          status: 403,
        });
      }
      const attempt = await (prisma as any).mediaUploadAttempt.findFirst({
        where: {
          assetId: String(assetId),
          vendorId,
          bookingId: String(session.bookingId),
          mediaSessionId: session.id,
          membershipId,
          blobKey: String(blobKey),
          state: { in: ["UPLOADING", "RETRY_REQUIRED"] },
        },
      });
      if (!attempt || !session.recordingGateDecisionId) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "UPLOAD_EVIDENCE_INCOMPLETE",
          message: "The upload cannot be saved because its recording evidence is incomplete.",
          status: 409,
        });
      }
      if (!String(mimeType).toLowerCase().startsWith("video/")) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_VIDEO_MIME_TYPE_REQUIRED",
          message: "Stage uploads must be video files.",
          status: 422,
        });
      }

      const booking = await prisma.booking.findFirst({
        where: { id: String(session.bookingId), vendorId },
        select: { id: true, status: true, customerMetadata: true },
      });
      if (!booking) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "WORK_RECORD_NOT_FOUND",
          message: "The work record for this upload is no longer available.",
          status: 404,
        });
      }
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId,
        surface: "upload_complete",
        capability: "record",
        actorKind: tokenAccess ? "EMPLOYEE_LINK" : String((membership as any).role || "VENDOR_MEMBER"),
      });
      if (permissionGate.blockCode) {
        await setUploadAttemptState({
          assetId,
          vendorId,
          state: "REJECTED",
          failureCode: permissionGate.blockCode,
          failureMessage: permissionGate.blockMessage,
        }).catch(() => undefined);
        return NextResponse.json(
          { ...recordingGateErrorBody(permissionGate), uploadState: "REJECTED" },
          { status: 409 }
        );
      }

      let blobProps: Awaited<ReturnType<typeof getBlobProperties>>;
      try {
        blobProps = await getBlobProperties(String(blobKey));
      } catch {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "RETRY_REQUIRED",
          code: "BLOB_VERIFICATION_FAILED",
          message: "The upload could not be verified in secure storage. Retry this saved video.",
          status: 503,
        });
      }
      if (!blobProps?.exists || !blobProps.contentLength || blobProps.contentLength <= 0) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "RETRY_REQUIRED",
          code: "BLOB_NOT_SAVED",
          message: "The video did not finish saving to secure storage. Retry this saved video.",
          status: 409,
        });
      }
      const actualBytes = BigInt(blobProps.contentLength);
      const usage = await calculateStorageUsage(vendorId);
      if (usage.usedBytes + actualBytes > usage.limitBytes) {
        await checkAndCreateStorageAlerts(vendorId, usage);
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STORAGE_LIMIT_REACHED",
          message: "Storage capacity is full. The manager must free storage before this video can be saved.",
          status: 403,
        });
      }

      const declaredDuration = Number(durationSeconds);
      if (!Number.isFinite(declaredDuration) || declaredDuration <= 0) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_VIDEO_DURATION_REQUIRED",
          message: "The video duration could not be read. Retake this stage with the camera.",
          status: 422,
        });
      }
      if (declaredDuration > STAGE_VIDEO_MAX_DURATION_SECONDS) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_VIDEO_TOO_LONG",
          message: `Stage videos must be ${STAGE_VIDEO_MAX_DURATION_SECONDS} seconds or less.`,
          status: 413,
          details: { maxDurationSeconds: STAGE_VIDEO_MAX_DURATION_SECONDS },
        });
      }

      let videoBuffer: Buffer;
      let verifiedDurationSeconds: number;
      try {
        videoBuffer = await downloadBlobToBuffer(String(blobKey));
        verifiedDurationSeconds = probeVideoDurationSecondsFromBuffer(videoBuffer, String(mimeType));
      } catch {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_VIDEO_DURATION_UNVERIFIABLE",
          message: "The uploaded file is not a supported, readable video. Retake this stage.",
          status: 422,
        });
      }
      if (verifiedDurationSeconds > STAGE_VIDEO_MAX_DURATION_SECONDS) {
        return failStagedUpload({
          assetId,
          vendorId,
          state: "REJECTED",
          code: "STAGE_VIDEO_TOO_LONG",
          message: `Stage videos must be ${STAGE_VIDEO_MAX_DURATION_SECONDS} seconds or less.`,
          status: 413,
          details: {
            maxDurationSeconds: STAGE_VIDEO_MAX_DURATION_SECONDS,
            durationSeconds: verifiedDurationSeconds,
            verifiedByServer: true,
          },
        });
      }

      const saved = await saveVerifiedServiceVideoStage({
        assetId: String(assetId),
        vendorId,
        bookingId: booking.id,
        mediaSessionId: session.id,
        membershipId,
        deviceId: deviceId ? String(deviceId) : null,
        bytes: actualBytes,
        mimeType: String(mimeType),
        blobKey: String(blobKey),
        blobUrl: blobUrl ? String(blobUrl) : null,
        stage: stageValue as ServiceVideoStage,
        captureProvenance: attempt.captureProvenance as CaptureProvenance,
        verifiedDurationSeconds,
        videoBuffer,
        gateDecisionId: String(session.recordingGateDecisionId),
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: setOperationalPhaseOnMetadataJson(booking.customerMetadata, "IN_PROGRESS") },
      });
      const updatedUsage = await calculateStorageUsage(vendorId);
      await checkAndCreateStorageAlerts(vendorId, updatedUsage);
      return NextResponse.json({
        success: true,
        uploadState: "SAVED",
        asset: {
          id: saved.asset.id,
          mediaSessionId: saved.asset.mediaSessionId,
          bytes: saved.asset.bytes.toString(),
          mimeType: saved.asset.mimeType,
          uploadState: saved.asset.uploadState,
          contentHash: saved.asset.contentHash,
          captureProvenance: saved.asset.captureProvenance,
          stageVersion: saved.asset.stageVersion,
        },
        storage: {
          usedBytes: updatedUsage.usedBytes.toString(),
          limitBytes: updatedUsage.limitBytes.toString(),
          percentUsed: updatedUsage.percentUsed,
        },
      });
    }

    let actualBytes = BigInt(bytes);
    try {
      const blobProps = await getBlobProperties(String(blobKey));
      if (blobProps?.exists && blobProps.contentLength && blobProps.contentLength > 0) {
        actualBytes = BigInt(blobProps.contentLength);
      }
    } catch {
      // Legacy non-staged uploads retain their existing compatibility behavior.
    }
    const usage = await calculateStorageUsage(vendorId);
    if (usage.usedBytes + actualBytes > usage.limitBytes) {
      await checkAndCreateStorageAlerts(vendorId, usage);
      return NextResponse.json({ error: "STORAGE_LIMIT_REACHED", message: "Storage limit would be exceeded." }, { status: 403 });
    }
    const asset = await (prisma as any).mediaAsset.create({
      data: {
        id: String(assetId),
        vendorId,
        mediaSessionId: session?.id || null,
        membershipId,
        uploadedByMembershipId: membershipId,
        deviceId: deviceId || null,
        bytes: actualBytes,
        mimeType: String(mimeType),
        blobKey: String(blobKey),
        blobUrl: blobUrl || null,
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
        uploadState: "SAVED",
        deletedAt: null,
      },
    });
    const updatedUsage = await calculateStorageUsage(vendorId);
    await checkAndCreateStorageAlerts(vendorId, updatedUsage);
    return NextResponse.json({
      success: true,
      uploadState: "SAVED",
      asset: { ...asset, bytes: asset.bytes.toString() },
      storage: {
        usedBytes: updatedUsage.usedBytes.toString(),
        limitBytes: updatedUsage.limitBytes.toString(),
        percentUsed: updatedUsage.percentUsed,
      },
    });
  } catch (error: any) {
    console.error("[media/upload/complete] POST error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Asset ID already exists" }, { status: 409 });
    }
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to complete upload", details: error?.message || "Unknown error", uploadState: "RETRY_REQUIRED" },
      { status: 500 }
    );
  }
}
