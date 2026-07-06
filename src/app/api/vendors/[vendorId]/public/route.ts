import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";
import {
  countableMediaAssetWhere,
  countableServiceWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import {
  cleanPublicMediaTitle,
  cleanPublicServiceDescription,
  cleanPublicServiceName,
  cleanPublicServicePrice,
} from "@/lib/launch-content-cleanup";
import {
  VENDOR_JOB_VIDEO_STAGE_LABELS,
  normalizeVendorJobVideoStage,
} from "@/lib/vendor-job-video-stages";
import { getBusinessHoursStatus } from "@/lib/business-hours";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/public
 * Public trust-safe vendor profile payload.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;

    const vendor = await withTransientDbRetry(() =>
      prisma.vendor.findFirst({
        where: countableVendorWhere({ id: vendorId, isPubliclyListed: true, accountStatus: "active" }),
        select: {
          id: true,
          name: true,
          businessName: true,
          businessType: true,
          category: true,
          bio: true,
          city: true,
          state: true,
          serviceAreas: true,
          businessHoursJson: true,
        },
      })
    );

    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const services = await withTransientDbRetry(() =>
      prisma.service.findMany({
        where: countableServiceWhere({ vendorId: vendor.id, isPublished: true }),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          createdAt: true,
        },
      })
    );

    const serviceIds = services.map((service) => service.id);
    let publicAssets: any[] = [];
    try {
      publicAssets = await withTransientDbRetry<any[]>(() =>
        (prisma as any).mediaAsset.findMany({
          where: countableMediaAssetWhere({
            vendorId: vendor.id,
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: {
              in: getVisibilityStatusesForAudience("public"),
            },
          }),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            mimeType: true,
            blobUrl: true,
            createdAt: true,
            mediaSession: {
              select: {
                serviceId: true,
                title: true,
                vendorJobVideoStage: true,
                sessionType: true,
              },
            },
          },
        })
      );
    } catch (publicAssetError) {
      if (!isTransientDbConnectivityError(publicAssetError)) throw publicAssetError;
      console.warn("[vendors/:vendorId/public] public media enrichment temporarily unavailable");
    }

    const proofSafePublicAssets = publicAssets.filter((asset: any) =>
      shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
    );

    const previewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    const primaryProofPreviewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const url = String(asset?.blobUrl || "").trim();
      if (!serviceId || !url || primaryProofPreviewByServiceId.has(serviceId)) continue;
      if (!String(asset?.mimeType || "").startsWith("video/")) continue;
      if (!isCompletedStageProofVideo(asset?.mediaSession || null)) continue;
      primaryProofPreviewByServiceId.set(serviceId, { url, type: "video" });
    }
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const url = String(asset?.blobUrl || "").trim();
      if (!serviceId || !url || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, {
        url,
        type: String(asset?.mimeType || "").startsWith("video/") ? "video" : "image",
      });
    }

    const publicVendorName = vendor.businessName || vendor.name;
    const publicServices = services.map((service) => {
      const previewMedia =
        primaryProofPreviewByServiceId.get(service.id) || previewByServiceId.get(service.id) || null;
      return {
        serviceId: service.id,
        serviceName: cleanPublicServiceName(service.name, publicVendorName),
        serviceDescription: cleanPublicServiceDescription(service.description, publicVendorName),
        price: cleanPublicServicePrice(service.price, service.name, service.description),
        previewMediaUrl: previewMedia?.url || null,
        previewMediaType: previewMedia?.type || null,
      };
    });

    const serviceNameById = new Map(
      publicServices.map((service) => [service.serviceId, service.serviceName] as const)
    );

    const latestGalleryAssetByStageKey = new Map<
      string,
      {
        mediaId: string;
        serviceId: string | null;
        serviceName: string | null;
        title: string;
        mimeType: string;
        url: string;
        createdAt: Date | string;
        stageKey: string | null;
        stageLabel: string | null;
        isPrimaryServiceVideo: boolean;
        isPrimaryProofVideo: boolean;
      }
    >();

    for (const asset of proofSafePublicAssets) {
      const url = String(asset?.blobUrl || "").trim();
      if (!url) continue;

      const serviceId = asset?.mediaSession?.serviceId ? String(asset.mediaSession.serviceId) : null;
      const stageKey = String(asset?.mediaSession?.vendorJobVideoStage || "").trim().toUpperCase() || null;
      const normalizedStageKey = stageKey || "GENERAL";
      const dedupeKey = `${serviceId || "vendor"}:${normalizedStageKey}`;
      if (latestGalleryAssetByStageKey.has(dedupeKey)) continue;

      const normalizedStage = normalizeVendorJobVideoStage(stageKey);
      const stageLabel = normalizedStage ? VENDOR_JOB_VIDEO_STAGE_LABELS[normalizedStage] : null;

      latestGalleryAssetByStageKey.set(dedupeKey, {
        mediaId: String(asset.id),
        serviceId,
        serviceName: serviceId ? serviceNameById.get(serviceId) || null : null,
        title: cleanPublicMediaTitle(asset?.mediaSession?.title || "Service Media"),
        mimeType: asset.mimeType,
        url,
        createdAt: asset.createdAt,
        stageKey,
        stageLabel,
        isPrimaryServiceVideo: isCompletedStageProofVideo(asset?.mediaSession || null),
        isPrimaryProofVideo: isCompletedStageProofVideo(asset?.mediaSession || null),
      });
    }

    const stageSortRank: Record<string, number> = {
      COMPLETED: 0,
      IN_PROGRESS: 1,
      INTRO: 2,
      GENERAL: 3,
    };

    const publicMedia = Array.from(latestGalleryAssetByStageKey.values()).sort((left, right) => {
      const leftRank = stageSortRank[left.stageKey || "GENERAL"] ?? 99;
      const rightRank = stageSortRank[right.stageKey || "GENERAL"] ?? 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    const serviceAreas =
      typeof vendor.serviceAreas === "string"
        ? vendor.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    let vendorReviewAgg:
      | {
          rating: number | null;
          reviewCount: number;
        }
      | undefined;
    try {
      vendorReviewAgg = (await withTransientDbRetry(() => getVendorReviewAggregatesForPublic([vendor.id]))).get(vendor.id);
    } catch (vendorReviewError) {
      if (!isTransientDbConnectivityError(vendorReviewError)) throw vendorReviewError;
      console.warn("[vendors/:vendorId/public] public review aggregate enrichment temporarily unavailable");
      vendorReviewAgg = undefined;
    }

    return NextResponse.json({
      success: true,
      vendor: {
        vendorId: vendor.id,
        vendorName: publicVendorName || "Unknown Vendor",
        businessType: vendor.businessType || null,
        category: vendor.category || null,
        bio: vendor.bio || null,
        location: [vendor.city, vendor.state].filter(Boolean).join(", ") || null,
        serviceAreas,
        businessHours: getBusinessHoursStatus((vendor as any).businessHoursJson || null),
        profilePhoto: null, // Intentionally omitted until profile-photo public visibility governance exists.
        rating: vendorReviewAgg?.rating ?? null,
        reviewCount: vendorReviewAgg?.reviewCount ?? null,
      },
      publicServices,
      publicMedia,
      meta: {
        serviceEligibilityRule:
          "Only active vendors with isPubliclyListed=true and services with isPublished=true are returned.",
        reviewEligibilityRule:
          "Public review aggregates use vendor-level DB reviews where moderationStatus=approved and visibilityStatus=public.",
        omittedForSafety: [
          "internal settings",
          "admin/moderation internals",
          "membership/device/internal management data",
          "private/customer_only/vendor_archive_only media",
          "pending/rejected/flagged media",
          "vendor profile photo (until governed as public-safe)",
        ],
        totalServicesForVendor: serviceIds.length,
        totalPublicServicesReturned: publicServices.length,
      },
    });
  } catch (error: any) {
    console.error("[vendors/:vendorId/public] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch public vendor profile", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
