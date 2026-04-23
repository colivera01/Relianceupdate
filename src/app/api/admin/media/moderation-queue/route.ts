import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  resolveVendorJobVideoStageFromSession,
  VENDOR_JOB_VIDEO_STAGE_LABELS,
} from "@/lib/vendor-job-video-stages";

const REQUIRED_STAGE_KEYS = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;
type RequiredStageKey = (typeof REQUIRED_STAGE_KEYS)[number];

/**
 * GET /api/admin/media/moderation-queue
 * Admin-only moderation queue listing for complete 3-stage job packages.
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
                status: true,
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
      const session = asset.mediaSession;
      const title =
        session?.title ||
        session?.booking?.title ||
        "Untitled Media";
      const stageKey = resolveVendorJobVideoStageFromSession({
        vendorJobVideoStage: session?.vendorJobVideoStage,
        sessionType: session?.sessionType,
      });
      const vendorJobVideoStageLabel =
        stageKey === "LEGACY_OTHER"
          ? "Legacy / unspecified"
          : VENDOR_JOB_VIDEO_STAGE_LABELS[stageKey];
      const isPrimaryProofStageVideo = stageKey === "COMPLETED";

      return {
        assetId: asset.id,
        title,
        vendorId: asset.vendorId,
        vendorName: asset.vendor?.businessName || asset.vendor?.name || null,
        mediaSessionId: asset.mediaSessionId || null,
        bookingId: session?.booking?.id || null,
        jobTitle: session?.booking?.title || null,
        bookingStatus: session?.booking?.status || null,
        clientName: session?.booking?.clientName || null,
        vendorJobVideoStageKey: stageKey,
        vendorJobVideoStageLabel,
        isPrimaryProofStageVideo,
        serviceId: session?.service?.id || session?.serviceId || null,
        serviceName: session?.service?.name || null,
        uploadedByMembershipId: asset.uploadedByMembershipId || null,
        employeeName: session?.employee?.name || null,
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

    const grouped = new Map<string, any>();
    for (const item of normalized) {
      const bookingId = String(item.bookingId || "");
      if (!bookingId) continue;
      const stageKey = String(item.vendorJobVideoStageKey || "");
      if (!REQUIRED_STAGE_KEYS.includes(stageKey as RequiredStageKey)) continue;
      if (!grouped.has(bookingId)) {
        grouped.set(bookingId, {
          packageId: bookingId,
          bookingId,
          jobTitle: item.jobTitle || item.title || "Untitled Job",
          bookingStatus: item.bookingStatus || null,
          vendorId: item.vendorId,
          vendorName: item.vendorName || null,
          clientName: item.clientName || null,
          serviceName: item.serviceName || null,
          createdAt: item.createdAt,
          uploadedByMembershipIds: new Set<string>(),
          stages: {
            INTRO: null,
            IN_PROGRESS: null,
            COMPLETED: null,
          } as Record<RequiredStageKey, any>,
        });
      }
      const pack = grouped.get(bookingId);
      if (item.vendorName) {
        pack.vendorName = item.vendorName;
      }
      if (item.clientName) {
        pack.clientName = item.clientName;
      }
      if (item.serviceName) {
        pack.serviceName = item.serviceName;
      }
      if (item.bookingStatus) {
        pack.bookingStatus = item.bookingStatus;
      }
      if (item.uploadedByMembershipId) {
        pack.uploadedByMembershipIds.add(String(item.uploadedByMembershipId));
      }
      const current = pack.stages[stageKey as RequiredStageKey];
      if (!current || new Date(item.createdAt).getTime() > new Date(current.createdAt).getTime()) {
        pack.stages[stageKey as RequiredStageKey] = item;
      }
      if (new Date(item.createdAt).getTime() > new Date(pack.createdAt).getTime()) {
        pack.createdAt = item.createdAt;
      }
    }

    const completePackages = Array.from(grouped.values())
      .filter((pack) => REQUIRED_STAGE_KEYS.every((key) => Boolean(pack.stages[key])))
      .map((pack) => {
        const intro = pack.stages.INTRO;
        const inProgress = pack.stages.IN_PROGRESS;
        const completed = pack.stages.COMPLETED;
        const videos = [intro, inProgress, completed];
        const moderationStatuses = Array.from(
          new Set(videos.map((video: any) => String(video.moderationStatus || "pending_review")))
        );
        return {
          packageId: pack.packageId,
          bookingId: pack.bookingId,
          jobTitle: pack.jobTitle,
          bookingStatus: pack.bookingStatus,
          vendorId: pack.vendorId,
          vendorName: pack.vendorName,
          clientName: pack.clientName,
          serviceName: pack.serviceName,
          createdAt: pack.createdAt,
          uploadedByMembershipIds: Array.from(pack.uploadedByMembershipIds),
          moderationStatuses,
          packageReadiness: "READY_FOR_ADMIN_REVIEW",
          videosByStage: {
            INTRO: intro,
            IN_PROGRESS: inProgress,
            COMPLETED: completed,
          },
        };
      });

    const filteredByStatus = moderationStatus
      ? completePackages.filter((pack) =>
          pack.moderationStatuses.some(
            (status: string) =>
              String(status || "").toLowerCase() === String(moderationStatus).toLowerCase()
          )
        )
      : completePackages;

    const filteredBySearch =
      search && search.trim()
        ? filteredByStatus.filter((item: any) => {
            const q = search.trim().toLowerCase();
            return (
              String(item.jobTitle || "").toLowerCase().includes(q) ||
              String(item.clientName || "").toLowerCase().includes(q) ||
              String(item.vendorName || "").toLowerCase().includes(q) ||
              String(item.bookingStatus || "").toLowerCase().includes(q) ||
              String(item.serviceName || "").toLowerCase().includes(q) ||
              REQUIRED_STAGE_KEYS.some((stage) =>
                String(item.videosByStage?.[stage]?.title || "").toLowerCase().includes(q)
              )
            );
          })
        : filteredByStatus;

    return NextResponse.json({
      success: true,
      message: "Moderation queue fetched successfully",
      packages: filteredBySearch,
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
