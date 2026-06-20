import { buildProofCard } from "@/lib/proof-card";
import type { DiscoverServiceResult, DiscoverServicesResponse } from "@/types/api";

type DemoInput = {
  q?: string | null;
  category?: string | null;
  sortBy?: string | null;
  page?: number;
  limit?: number;
};

const DEMO_VIDEO_URL = "/homepage/service-video-stages/completed-service.mp4";

function createDemoResult(input: {
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  location: string;
  price: number;
  rating: number | null;
  reviewCount: number | null;
  trustScore: DiscoverServiceResult["trustScore"];
  previewMediaUrl: string | null;
  previewMediaType: DiscoverServiceResult["previewMediaType"];
  hasPublicMedia: boolean;
  stageAvailability: {
    startingCondition: boolean;
    workInProgress: boolean;
    finalResult: boolean;
  };
}): DiscoverServiceResult {
  return {
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    serviceDescription: input.serviceDescription,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    vendorCategory: input.vendorCategory,
    vendorBusinessType: input.vendorCategory,
    location: input.location,
    distanceMiles: null,
    previewMediaUrl: input.previewMediaUrl,
    previewMediaType: input.previewMediaType,
    price: input.price,
    rating: input.rating,
    reviewCount: input.reviewCount,
    trustScore: input.trustScore,
    badges: {
      verified: null,
      featured: null,
    },
    publicListing: {
      serviceEligible: true,
      hasPublicMedia: input.hasPublicMedia,
    },
    proofCard: buildProofCard({
      serviceName: input.serviceName,
      vendorName: input.vendorName,
      stageAvailability: input.stageAvailability,
      hasPublicMedia: input.hasPublicMedia,
      reviewCount: input.reviewCount,
      trustScore: input.trustScore,
    }),
  };
}

export function buildProofCardDemoDiscoverResponse(input: DemoInput = {}): DiscoverServicesResponse {
  const allResults = [
    createDemoResult({
      serviceId: "dev-proof-public-completed-service",
      serviceName: "Outlet Installation",
      serviceDescription:
        "Completed electrical outlet installation with approved public service video and customer-ready evidence.",
      vendorId: "dev-proof-vendor-public",
      vendorName: "Reliance Service Demo Electric",
      vendorCategory: "Electrician",
      location: "Winter Springs, Florida",
      price: 185,
      rating: 5,
      reviewCount: 3,
      previewMediaUrl: DEMO_VIDEO_URL,
      previewMediaType: "video",
      hasPublicMedia: true,
      stageAvailability: {
        startingCondition: true,
        workInProgress: true,
        finalResult: true,
      },
      trustScore: {
        scored: true,
        totalScorePct: 96,
        maturityState: "emerging",
        maturityLabel: "Emerging",
        evidence: {
          verifiedBookings: 9,
          approvedServiceVideos: 3,
          validatedDisputes: 0,
        },
      },
    }),
    createDemoResult({
      serviceId: "dev-proof-partial-review-trust",
      serviceName: "Panel Inspection",
      serviceDescription:
        "A service with customer review and Trust Score context, but no completed public service video yet.",
      vendorId: "dev-proof-vendor-partial",
      vendorName: "Reliance Service Demo Inspectors",
      vendorCategory: "Electrician",
      location: "Orlando, Florida",
      price: 120,
      rating: 4.8,
      reviewCount: 5,
      previewMediaUrl: null,
      previewMediaType: null,
      hasPublicMedia: false,
      stageAvailability: {
        startingCondition: true,
        workInProgress: false,
        finalResult: false,
      },
      trustScore: {
        scored: true,
        totalScorePct: 91,
        maturityState: "early_stage",
        maturityLabel: "Early Stage",
        evidence: {
          verifiedBookings: 4,
          approvedServiceVideos: 0,
          validatedDisputes: 0,
        },
      },
    }),
    createDemoResult({
      serviceId: "dev-proof-service-offered-only",
      serviceName: "Lighting Installation",
      serviceDescription:
        "A public work type customers can understand before proof, reviews, or completed-service video are available.",
      vendorId: "dev-proof-vendor-service-only",
      vendorName: "Reliance Proof Demo Lighting",
      vendorCategory: "Electrician",
      location: "Sanford, Florida",
      price: 95,
      rating: null,
      reviewCount: 0,
      previewMediaUrl: null,
      previewMediaType: null,
      hasPublicMedia: false,
      stageAvailability: {
        startingCondition: false,
        workInProgress: false,
        finalResult: false,
      },
      trustScore: {
        scored: false,
        totalScorePct: null,
        maturityState: "not_ready",
        maturityLabel: "Building",
        evidence: {
          verifiedBookings: 0,
          approvedServiceVideos: 0,
          validatedDisputes: 0,
        },
      },
    }),
  ];

  const q = String(input.q || "").trim().toLowerCase();
  const category = String(input.category || "").trim().toLowerCase();
  const page = Math.max(Number(input.page) || 1, 1);
  const limit = Math.max(Number(input.limit) || allResults.length, 1);

  const filtered = allResults.filter((item) => {
    const categoryMatches =
      !category ||
      String(item.vendorCategory || "").toLowerCase() === category ||
      String(item.vendorBusinessType || "").toLowerCase() === category;
    const textMatches =
      !q ||
      [item.serviceName, item.serviceDescription, item.vendorName, item.vendorCategory]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return categoryMatches && textMatches;
  });

  const start = (page - 1) * limit;
  const results = filtered.slice(start, start + limit);

  return {
    success: true,
    promotedListings: [],
    results,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(Math.ceil(filtered.length / limit), 1),
    },
    appliedFilters: {
      q: q || null,
      category: category || null,
      sortBy: input.sortBy || "newest",
      radiusMiles: null,
    },
    location: {
      inputAccepted: false,
      inputSource: "none",
      distanceFilteringApplied: false,
      distanceSortingApplied: false,
      supportedFutureInputs: ["coordinates", "zipCode"],
    },
  };
}
