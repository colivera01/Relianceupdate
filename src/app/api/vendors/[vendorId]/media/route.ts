// src/app/api/vendors/[vendorId]/media/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import {
  ARCHIVE_ACTIVE,
  ARCHIVE_ARCHIVED,
  getApprovedActiveBaseWhere,
  getVisibilityStatusesForAudience,
  normalizeArchiveStatus,
} from "@/lib/media-visibility";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

function deriveMediaPurposeFromSessionType(sessionType: unknown): "progress" | "completion" {
  const normalized = String(sessionType || "").trim().toLowerCase();
  return normalized.includes("completion") ? "completion" : "progress";
}

/**
 * GET /api/vendors/[vendorId]/media
 * List all media assets for a vendor (vendor-scoped, excludes deleted)
 */
export async function GET(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const where: any = {
      vendorId,
      ...getApprovedActiveBaseWhere(),
      visibilityStatus: {
        in: getVisibilityStatusesForAudience("vendor_internal"),
      },
    }

    // Deprecated behavior: includeDeleted no longer bypasses moderation visibility guardrails.
    if (includeDeleted && process.env.NODE_ENV === "development") {
      console.warn(
        "[vendors/:vendorId/media] includeDeleted ignored; route always enforces approved+active media."
      );
    }

    const assets = await (prisma as any).mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        mediaSession: {
          include: {
            booking: {
              select: {
                id: true,
                title: true,
                clientName: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
              },
            },
            employee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
        assetId: asset.id,
        id: asset.id,
        vendorId: asset.vendorId,
        mediaSessionId: asset.mediaSessionId,
        membershipId: asset.membershipId,
        uploadedByMembershipId: asset.uploadedByMembershipId,
        deviceId: asset.deviceId,
        bytes: asset.bytes.toString(),
        mimeType: asset.mimeType,
        blobKey: asset.blobKey,
        blobUrl: asset.blobUrl,
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        archiveStatus:
          asset.deletedAt != null
            ? ARCHIVE_ARCHIVED
            : normalizeArchiveStatus(asset.archiveStatus || ARCHIVE_ACTIVE),
        moderationReason: asset.moderationReason,
        moderatedAt: asset.moderatedAt,
        title: asset.mediaSession?.title || asset.mediaSession?.booking?.title || "Service Media",
        jobTitle: asset.mediaSession?.booking?.title || null,
        bookingId: asset.mediaSession?.booking?.id || null,
        clientName: asset.mediaSession?.booking?.clientName || null,
        serviceId: asset.mediaSession?.service?.id || asset.mediaSession?.serviceId || null,
        serviceName: asset.mediaSession?.service?.name || null,
        sessionType: asset.mediaSession?.sessionType || null,
        mediaPurpose: deriveMediaPurposeFromSessionType(asset.mediaSession?.sessionType),
        employeeName: asset.mediaSession?.employee?.name || null,
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

