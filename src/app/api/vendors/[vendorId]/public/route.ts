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
  cleanPublicServiceName,
  cleanPublicServicePrice,
  getPublicServiceDescriptionPresentation,
} from "@/lib/launch-content-cleanup";
import {
  VENDOR_JOB_VIDEO_STAGE_LABELS,
  normalizeVendorJobVideoStage,
} from "@/lib/vendor-job-video-stages";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";
import { getPublicBusinessHours } from "@/lib/business-hours";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

function parsePublicList(value: string | null | undefined): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      // Fall through to the legacy delimiter parser.
    }
  }

  const explicitRows = raw.split(/[;|\n]+/).map((item) => item.trim()).filter(Boolean);
  if (explicitRows.length > 1) return explicitRows;

  const commaParts = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (
    commaParts.length >= 2 &&
    commaParts.length % 2 === 0 &&
    commaParts.every((item, index) => index % 2 === 0 || /^[A-Z]{2}$/i.test(item))
  ) {
    return commaParts.reduce<string[]>((rows, item, index) => {
      if (index % 2 === 0) rows.push(`${item}, ${commaParts[index + 1].toUpperCase()}`);
      return rows;
    }, []);
  }

  return commaParts;
}

function uniquePublicList(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizePublicWebsite(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
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
          website: true,
          city: true,
          state: true,
          serviceAreas: true,
          businessHoursJson: true,
          serviceTypes: true,
          specializations: true,
          foundedYear: true,
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
    let publicMediaStatus: "available" | "temporarily_unavailable" = "available";
    try {
      const canonicalPublicAssetIds = await resolveCanonicalPublicAssetIds({ vendorId: vendor.id });
      publicAssets = await withTransientDbRetry<any[]>(() =>
        (prisma as any).mediaAsset.findMany({
          where: countableMediaAssetWhere({
            id: { in: canonicalPublicAssetIds },
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
                id: true,
                bookingId: true,
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
      publicMediaStatus = "temporarily_unavailable";
    }

    const proofSafePublicAssets = publicAssets.filter((asset: any) =>
      shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
    );

    const previewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    const primaryProofPreviewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const url = asset?.id ? `/api/public/media/${asset.id}` : "";
      if (!serviceId || !url || primaryProofPreviewByServiceId.has(serviceId)) continue;
      if (!String(asset?.mimeType || "").startsWith("video/")) continue;
      if (!isCompletedStageProofVideo(asset?.mediaSession || null)) continue;
      primaryProofPreviewByServiceId.set(serviceId, { url, type: "video" });
    }
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const url = asset?.id ? `/api/public/media/${asset.id}` : "";
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
      const presentation = getPublicServiceDescriptionPresentation(service.description, publicVendorName);
      return {
        serviceId: service.id,
        serviceName: cleanPublicServiceName(service.name, publicVendorName),
        serviceDescription: presentation.description,
        durationLabel: presentation.durationLabel,
        price: cleanPublicServicePrice(service.price, service.name, service.description),
        previewMediaUrl: previewMedia?.url || null,
        previewMediaType: previewMedia?.type || null,
      };
    });

    const serviceNameById = new Map(
      publicServices.map((service) => [service.serviceId, service.serviceName] as const)
    );

    const completedPublicWorkByRecord = new Map<
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
      const url = asset?.id ? `/api/public/media/${asset.id}` : "";
      if (!url) continue;

      if (!isCompletedStageProofVideo(asset?.mediaSession || null)) continue;

      const serviceId = asset?.mediaSession?.serviceId ? String(asset.mediaSession.serviceId) : null;
      const stageKey = String(asset?.mediaSession?.vendorJobVideoStage || "").trim().toUpperCase() || null;
      const bookingId = String(asset?.mediaSession?.bookingId || "").trim();
      const mediaSessionId = String(asset?.mediaSession?.id || "").trim();
      const recordKey = bookingId || mediaSessionId || String(asset.id);
      if (completedPublicWorkByRecord.has(recordKey)) continue;

      const normalizedStage = normalizeVendorJobVideoStage(stageKey);
      const stageLabel = normalizedStage ? VENDOR_JOB_VIDEO_STAGE_LABELS[normalizedStage] : null;

      completedPublicWorkByRecord.set(recordKey, {
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

    const publicMedia = Array.from(completedPublicWorkByRecord.values()).sort((left, right) => {
      const leftRank = stageSortRank[left.stageKey || "GENERAL"] ?? 99;
      const rightRank = stageSortRank[right.stageKey || "GENERAL"] ?? 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    const servicesWithPublicProof = new Set(
      publicMedia
        .map((asset) => String(asset.serviceId || "").trim())
        .filter(Boolean)
    );

    const serviceAreas = parsePublicList(vendor.serviceAreas);
    const broadLabels = new Set(
      [vendor.category, vendor.businessType]
        .map((value) => String(value || "").trim().toLocaleLowerCase())
        .filter(Boolean)
    );
    const specialties = uniquePublicList([
      ...parsePublicList(vendor.serviceTypes),
      ...parsePublicList(vendor.specializations),
    ]).filter((value) => !broadLabels.has(value.toLocaleLowerCase()));
    let reviewMetricsStatus: "available" | "temporarily_unavailable" = "available";
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
      reviewMetricsStatus = "temporarily_unavailable";
    }

    return NextResponse.json({
      success: true,
      vendor: {
        vendorId: vendor.id,
        vendorName: publicVendorName || "Unknown Vendor",
        businessType: vendor.businessType || null,
        category: vendor.category || null,
        bio: vendor.bio || null,
        website: normalizePublicWebsite(vendor.website),
        foundedYear: vendor.foundedYear || null,
        specialties,
        location: [vendor.city, vendor.state].filter(Boolean).join(", ") || null,
        serviceAreas,
        businessHours: getPublicBusinessHours((vendor as any).businessHoursJson || null),
        profilePhoto: null, // Intentionally omitted until profile-photo public visibility governance exists.
        rating: vendorReviewAgg?.rating ?? null,
        reviewCount: vendorReviewAgg?.reviewCount ?? null,
      },
      publicServices,
      publicMedia,
      publicProofSummary: {
        completedWorkCount: publicMedia.length,
        publicMediaCount: publicMedia.length,
        servicesWithPublicProof: servicesWithPublicProof.size,
      },
      dataStatus: {
        publicMedia: publicMediaStatus,
        reviewMetrics: reviewMetricsStatus,
      },
      meta: {
        serviceEligibilityRule:
          "Only active vendors with isPubliclyListed=true and services with isPublished=true are returned.",
        reviewEligibilityRule:
          "Business rating aggregates use canonical verified customer star ratings; written comments retain separate public moderation.",
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
