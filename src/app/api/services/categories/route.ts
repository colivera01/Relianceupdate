import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";
import { resolveVendorJobVideoStageFromSession } from "@/lib/vendor-job-video-stages";
import {
  countableMediaAssetWhere,
  countableServiceWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

const FALLBACK_CATEGORY_LABEL = "Other Services";

type ProofStageAvailability = {
  startingCondition: boolean;
  workInProgress: boolean;
  finalResult: boolean;
};

/**
 * GET /api/services/categories
 * Public-safe category aggregation for browse.
 *
 * Counts only services that are currently visible in public discovery:
 * - vendor is publicly listed and active
 * - service is explicitly published
 * - service has approved, active, public videos for all three proof stages
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = await withTransientDbRetry(() =>
      prisma.service.findMany({
        where: countableServiceWhere({
          isPublished: true,
          vendor: countableVendorWhere({
            isPubliclyListed: true,
            accountStatus: "active",
          }),
        }),
        select: {
          id: true,
          name: true,
          vendorId: true,
          vendor: {
            select: {
              category: true,
              businessType: true,
            },
          },
        },
      })
    );

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
        meta: {
          countedServices: 0,
          note: "No public-eligible service inventory currently available.",
        },
      });
    }

    const serviceIds = services.map((service) => service.id);
    const publicAssets = await withTransientDbRetry<any[]>(() =>
      (prisma as any).mediaAsset.findMany({
        where: countableMediaAssetWhere({
          ...getApprovedActiveBaseWhere(),
          visibilityStatus: {
            in: getVisibilityStatusesForAudience("public"),
          },
          mediaSession: {
            serviceId: { in: serviceIds },
          },
        }),
        select: {
          mimeType: true,
          blobUrl: true,
          mediaSession: {
            select: {
              serviceId: true,
              vendorJobVideoStage: true,
              sessionType: true,
            },
          },
        },
      })
    );

    const stageAvailabilityByServiceId = new Map<string, ProofStageAvailability>();
    const completedPublicPreviewServiceIds = new Set<string>();

    const ensureStageAvailability = (serviceId: string): ProofStageAvailability => {
      const existing = stageAvailabilityByServiceId.get(serviceId);
      if (existing) return existing;
      const next = {
        startingCondition: false,
        workInProgress: false,
        finalResult: false,
      };
      stageAvailabilityByServiceId.set(serviceId, next);
      return next;
    };

    for (const asset of publicAssets) {
      const mediaSession = asset?.mediaSession || null;
      if (!shouldIncludeAssetForCustomerPublicProof(mediaSession)) continue;
      if (!String(asset?.mimeType || "").startsWith("video/")) continue;

      const serviceId = String(mediaSession?.serviceId || "");
      if (!serviceId) continue;

      if (String(asset?.blobUrl || "").trim() && isCompletedStageProofVideo(mediaSession)) {
        completedPublicPreviewServiceIds.add(serviceId);
      }

      const stage = resolveVendorJobVideoStageFromSession(mediaSession);
      const availability = ensureStageAvailability(serviceId);
      if (stage === "INTRO") availability.startingCondition = true;
      if (stage === "IN_PROGRESS") availability.workInProgress = true;
      if (stage === "COMPLETED") availability.finalResult = true;
    }

    const proofEligibleServices = services.filter((service) => {
      const availability = stageAvailabilityByServiceId.get(service.id);
      return Boolean(
        completedPublicPreviewServiceIds.has(service.id) &&
          availability?.startingCondition &&
          availability?.workInProgress &&
          availability?.finalResult
      );
    });

    if (proofEligibleServices.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
        meta: {
          countedServices: 0,
          scannedPublishedServices: services.length,
          eligibilityRule:
            "No service categories are shown until a published service has approved, active, public videos for Starting Condition, Work in Progress, and Final Result.",
        },
      });
    }

    const categoryMap = new Map<
      string,
      {
        key: string;
        label: string;
        serviceIds: Set<string>;
        vendorIds: Set<string>;
        sampleServiceNames: string[];
      }
    >();

    for (const service of proofEligibleServices) {
      const rawCategory = String(service.vendor.category || service.vendor.businessType || "").trim();
      const categoryLabel = rawCategory || FALLBACK_CATEGORY_LABEL;
      const categoryKey = categoryLabel.toLowerCase().replace(/\s+/g, "-");

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          key: categoryKey,
          label: categoryLabel,
          serviceIds: new Set(),
          vendorIds: new Set(),
          sampleServiceNames: [],
        });
      }

      const entry = categoryMap.get(categoryKey)!;
      entry.serviceIds.add(service.id);
      entry.vendorIds.add(service.vendorId);
      if (entry.sampleServiceNames.length < 3) {
        entry.sampleServiceNames.push(service.name);
      }
    }

    const categories = Array.from(categoryMap.values())
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        serviceCount: entry.serviceIds.size,
        vendorCount: entry.vendorIds.size,
        sampleServices: entry.sampleServiceNames,
      }))
      .sort((a, b) => b.serviceCount - a.serviceCount || a.label.localeCompare(b.label));

    return NextResponse.json({
      success: true,
      categories,
      meta: {
        countedServices: proofEligibleServices.length,
        scannedPublishedServices: services.length,
        eligibilityRule:
          "Only published services from active public vendors with approved public Starting Condition, Work in Progress, and Final Result videos are counted.",
      },
    });
  } catch (error: any) {
    console.error("[services/categories] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
          details: error?.message || "Transient database connectivity issue",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch category aggregation", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
