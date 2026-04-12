import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/media/moderation-queue
 * Admin-only moderation queue listing for media assets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const moderationStatus = searchParams.get("moderationStatus");
    const vendorId = searchParams.get("vendorId");
    const uploadedByMembershipId = searchParams.get("uploadedByMembershipId");
    const date = searchParams.get("date"); // YYYY-MM-DD
    const search = searchParams.get("search");

    const where: any = {};
    if (moderationStatus) where.moderationStatus = moderationStatus;
    if (vendorId) where.vendorId = vendorId;
    if (uploadedByMembershipId) where.uploadedByMembershipId = uploadedByMembershipId;
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        where.createdAt = { gte: start, lte: end };
      }
    }

    const assets = await (prisma as any).mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            businessName: true,
          },
        },
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
      take: 300,
    });

    const normalized = assets.map((asset: any) => {
      const title =
        asset.mediaSession?.title ||
        asset.mediaSession?.booking?.title ||
        "Untitled Media";
      return {
        assetId: asset.id,
        title,
        vendorId: asset.vendorId,
        vendorName: asset.vendor?.businessName || asset.vendor?.name || null,
        mediaSessionId: asset.mediaSessionId || null,
        bookingId: asset.mediaSession?.booking?.id || null,
        jobTitle: asset.mediaSession?.booking?.title || null,
        clientName: asset.mediaSession?.booking?.clientName || null,
        serviceId: asset.mediaSession?.service?.id || asset.mediaSession?.serviceId || null,
        serviceName: asset.mediaSession?.service?.name || null,
        uploadedByMembershipId: asset.uploadedByMembershipId || null,
        employeeName: asset.mediaSession?.employee?.name || null,
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        archiveStatus: asset.archiveStatus,
        moderationReason: asset.moderationReason,
        moderatedAt: asset.moderatedAt,
        createdAt: asset.createdAt,
        mimeType: asset.mimeType,
        bytes: typeof asset.bytes === "bigint" ? asset.bytes.toString() : String(asset.bytes || "0"),
        previewRef: asset.blobUrl || null,
        downloadRef: `/api/vendors/${asset.vendorId}/media/${asset.id}/download`,
      };
    });

    const filteredBySearch =
      search && search.trim()
        ? normalized.filter((item: any) => {
            const q = search.trim().toLowerCase();
            return (
              String(item.title || "").toLowerCase().includes(q) ||
              String(item.jobTitle || "").toLowerCase().includes(q) ||
              String(item.clientName || "").toLowerCase().includes(q)
            );
          })
        : normalized;

    return NextResponse.json({
      success: true,
      message: "Moderation queue fetched successfully",
      assets: filteredBySearch,
    });
  } catch (error: any) {
    console.error("[admin/media/moderation-queue] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch moderation queue",
        message: "Failed to fetch moderation queue",
      },
      { status: 500 }
    );
  }
}
