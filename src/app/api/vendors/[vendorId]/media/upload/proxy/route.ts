import { NextResponse } from "next/server";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { uploadBlobBuffer } from "@/lib/azure-blob-storage";
import { prisma } from "@/server/db";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { setUploadAttemptState } from "@/lib/service-video-evidence";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

const MAX_PROXY_UPLOAD_BYTES = 80 * 1024 * 1024;

function isSafeVendorMediaBlobKey(vendorId: string, assetId: string, blobKey: string): boolean {
  const normalizedVendorId = String(vendorId || "").trim();
  const normalizedAssetId = String(assetId || "").trim();
  const normalizedBlobKey = String(blobKey || "").trim();
  if (!normalizedVendorId || !normalizedAssetId || !normalizedBlobKey) return false;
  if (normalizedBlobKey.includes("..") || normalizedBlobKey.startsWith("/") || normalizedBlobKey.includes("\\")) {
    return false;
  }
  return normalizedBlobKey.startsWith(`vendor/${normalizedVendorId}/media/${normalizedAssetId}.`);
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const url = new URL(request.url);
    const assetId = String(
      request.headers.get("x-reliance-asset-id") || url.searchParams.get("assetId") || ""
    ).trim();
    const blobKey = String(
      request.headers.get("x-reliance-blob-key") || url.searchParams.get("blobKey") || ""
    ).trim();
    const bookingId = String(
      request.headers.get("x-reliance-booking-id") || url.searchParams.get("bookingId") || ""
    ).trim();
    const mimeType = request.headers.get("content-type") || "video/mp4";

    const tokenAccess = await resolveEmployeeCaptureAccess(request, {
      vendorId,
      bookingId: bookingId || null,
    });
    const membership = tokenAccess || (await requireVendorMembership(request, vendorId));

    if (!assetId || !blobKey) {
      return NextResponse.json(
        { error: "assetId and blobKey are required" },
        { status: 422 }
      );
    }

    if (!isSafeVendorMediaBlobKey(vendorId, assetId, blobKey)) {
      return NextResponse.json(
        { error: "Invalid blobKey for this vendor upload" },
        { status: 422 }
      );
    }

    const membershipId = tokenAccess?.membershipId || membership.membershipId;
    const uploadAttempt = bookingId
      ? await (prisma as any).mediaUploadAttempt.findFirst({
          where: {
            assetId,
            vendorId,
            bookingId,
            membershipId,
            blobKey,
            state: { in: ["UPLOADING", "RETRY_REQUIRED"] },
          },
        })
      : null;
    if (bookingId && !uploadAttempt) {
      return NextResponse.json(
        { error: "Upload evidence was not found for this staged recording." },
        { status: 409 }
      );
    }
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, vendorId },
        select: { id: true, customerMetadata: true },
      });
      if (!booking) {
        return NextResponse.json({ error: "Invalid bookingId for this vendor" }, { status: 422 });
      }
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId,
        surface: "upload_proxy",
        capability: "record",
        actorKind: tokenAccess ? "EMPLOYEE_LINK" : String((membership as any).role || "VENDOR_MEMBER"),
        recordingStage: String(uploadAttempt?.stage || "").trim().toUpperCase(),
      });
      if (permissionGate.blockCode) {
        return NextResponse.json(recordingGateErrorBody(permissionGate), { status: 409 });
      }
    }

    if (!mimeType.toLowerCase().startsWith("video/")) {
      await setUploadAttemptState({
        assetId,
        vendorId,
        state: "REJECTED",
        failureCode: "INVALID_MEDIA_TYPE",
        failureMessage: "Stage uploads must be video files.",
      }).catch(() => undefined);
      return NextResponse.json(
        { error: "Stage uploads must be video files." },
        { status: 422 }
      );
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PROXY_UPLOAD_BYTES) {
      await setUploadAttemptState({
        assetId,
        vendorId,
        state: "REJECTED",
        failureCode: "PROXY_UPLOAD_SIZE_LIMIT",
        failureMessage: "The fallback upload was empty or exceeded the allowed size.",
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: "PROXY_UPLOAD_SIZE_LIMIT",
          message: "This video is too large to upload through the phone fallback. Retake a shorter clip.",
          maxBytes: MAX_PROXY_UPLOAD_BYTES,
        },
        { status: 413 }
      );
    }

    try {
      await uploadBlobBuffer(blobKey, bytes, {
        contentType: mimeType,
        metadata: {
          uploadPath: "employee_proxy_fallback",
          assetId,
        },
      });
    } catch (uploadError: any) {
      await setUploadAttemptState({
        assetId,
        vendorId,
        state: "RETRY_REQUIRED",
        failureCode: "PROXY_UPLOAD_FAILED",
        failureMessage: "The video did not reach secure storage. Retry is required.",
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: "PROXY_UPLOAD_FAILED",
          message: "Upload did not finish. Retry this saved video.",
          details: uploadError?.message || "Unknown upload error",
          uploadState: "RETRY_REQUIRED",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      assetId,
      blobKey,
      bytes: bytes.length,
      mimeType,
      uploadPath: "proxy",
      uploadState: bookingId ? "UPLOADING" : undefined,
    });
  } catch (error: any) {
    console.error("[media/upload/proxy] POST error:", error);
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to proxy upload media", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
