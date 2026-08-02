import type { VendorOnboardingState } from "@/lib/vendor-onboarding-state";

type PromotionBrowseReadiness = {
  organicBrowseCount: number;
  desktopMinimumOrganicCount: number;
  categoryMinimumOrganicCount: number;
  desktopBrowseEligible: boolean;
  categoriesMeetingMinimum: number;
  totalCategoriesWithListings: number;
};

type PromotionServiceOption = {
  id: string;
  name: string;
  isPublished: boolean;
};

type PromotionRecentRequest = {
  id: string;
  status: string;
  paymentStatus: string;
  packageKey: string;
  createdAt: string | null;
};

export type VendorGrowthMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
};

export type VendorGrowthNextStep = {
  label: string;
  detail: string;
  href: string;
};

export type VendorGrowthSummary = {
  visibilityTitle: string;
  visibilityDetail: string;
  publicProfileHref: string | null;
  metrics: VendorGrowthMetric[];
  promotionStatus: {
    label: string;
    detail: string;
    tone: "success" | "warning" | "neutral";
  };
  nextSteps: VendorGrowthNextStep[];
};

type BuildVendorGrowthSummaryInput = {
  vendorId?: string | null;
  businessName?: string | null;
  onboarding?: VendorOnboardingState | null;
  publishedReviewCount?: number | null;
  approvedServiceVideoCount?: number | null;
  publicServiceOrderCount?: number | null;
  promotionBrowseReadiness?: PromotionBrowseReadiness | null;
  promotionServices?: PromotionServiceOption[] | null;
  promotionRecentRequests?: PromotionRecentRequest[] | null;
};

function toCount(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function hasInFlightPromotionRequest(requests: PromotionRecentRequest[]): boolean {
  return requests.some((request) => {
    const status = String(request.status || "").trim().toLowerCase();
    return status === "draft" || status === "scheduled" || status === "active";
  });
}

export function buildVendorGrowthSummary(
  input: BuildVendorGrowthSummaryInput
): VendorGrowthSummary {
  const onboarding = input.onboarding || null;
  const vendorId = String(input.vendorId || "").trim();
  const publishedReviewCount = toCount(input.publishedReviewCount);
  const approvedServiceVideoCount = toCount(input.approvedServiceVideoCount);
  const publicServiceOrderCount = toCount(input.publicServiceOrderCount ?? input.approvedServiceVideoCount);
  const publishedServiceCount = toCount(onboarding?.publishedServiceCount);
  const serviceDraftCount = toCount(onboarding?.serviceDraftCount);
  const promotionServices = Array.isArray(input.promotionServices) ? input.promotionServices : [];
  const promotionRecentRequests = Array.isArray(input.promotionRecentRequests)
    ? input.promotionRecentRequests
    : [];
  const publicProfileHref =
    vendorId && onboarding?.isPubliclyListed ? `/vendors/${encodeURIComponent(vendorId)}` : null;

  let visibilityTitle = "Public visibility is still building";
  let visibilityDetail =
    "Finish your profile, publish services, and keep completed work moving so customers can find and trust your business.";

  if (onboarding?.vendorVisibleToPublic) {
    visibilityTitle = "Your business is visible to customers";
    visibilityDetail =
      "Customers can already find your published services offered. The next growth levers are stronger customer-visible evidence, approved service videos, and published reviews.";
  } else if (onboarding?.membershipStatus === "PENDING") {
    visibilityTitle = "Your business is not public yet";
    visibilityDetail =
      "Reliance has your profile and services on file, but customers cannot find the business until admin approval is complete.";
  } else if (onboarding?.membershipStatus === "ACTIVE" && !onboarding.isPubliclyListed) {
    visibilityTitle = "Your business is approved, but not listed yet";
    visibilityDetail =
      "Your vendor access is ready. Public visibility starts after Reliance lists the business and publishes at least one service.";
  } else if (onboarding?.isPubliclyListed && publishedServiceCount === 0) {
    visibilityTitle = "Your business is listed, but services are not request-ready yet";
    visibilityDetail =
      "Your public profile can exist, but customers still need at least one published service offered before they can discover your work and request service.";
  }

  let promotionStatus: VendorGrowthSummary["promotionStatus"] = {
    label: "Not ready for promotions yet",
    detail:
      "Promotions become useful after your business is public and at least one service is published.",
    tone: "warning",
  };

  if (hasInFlightPromotionRequest(promotionRecentRequests)) {
    promotionStatus = {
      label: "Promotion request already in progress",
      detail:
        "Reliance is already reviewing or running a promotion request for this business. Keep improving public trust signals while it moves forward.",
      tone: "neutral",
    };
  } else if (onboarding?.vendorVisibleToPublic && publishedServiceCount > 0) {
    const publishedPromotionServices = promotionServices.filter((service) => service.isPublished);
    if (publishedPromotionServices.length === 0) {
      promotionStatus = {
        label: "Publish a service before requesting promotion",
        detail:
          "Featured placements only help once customers can open a published Service Offered from Explore Proof.",
        tone: "warning",
      };
    } else if (input.promotionBrowseReadiness && !input.promotionBrowseReadiness.desktopBrowseEligible) {
      promotionStatus = {
        label: "Eligible to request, but browse inventory is still thin",
        detail: `Reliance can review a promotion request now, but featured placement may wait until public browse grows beyond ${input.promotionBrowseReadiness.desktopMinimumOrganicCount} organic desktop listings.`,
        tone: "neutral",
      };
    } else {
      promotionStatus = {
        label: "Eligible to request promotion review",
        detail:
          "Your public profile and published services offered are ready for Reliance to review for extra public visibility.",
        tone: "success",
      };
    }
  }

  const metrics: VendorGrowthMetric[] = [
    {
      label: "Business profile public status",
      value: onboarding?.publicVisibilityLabel || "Not public yet",
      detail:
        onboarding?.vendorVisibleToPublic
          ? "Customers can reach your public-facing business profile now."
          : "This tells you whether customers can currently find your business.",
      tone: onboarding?.vendorVisibleToPublic ? "success" : "warning",
    },
    {
      label: "Published services",
      value: String(publishedServiceCount),
      detail:
        publishedServiceCount > 0
          ? "Published services help customers find your business in search and browse."
          : "Customers need at least one published service offered before they can discover your work publicly.",
      tone: publishedServiceCount > 0 ? "success" : "warning",
    },
    {
      label: "Published reviews",
      value: String(publishedReviewCount),
      detail:
        publishedReviewCount > 0
          ? "Published reviews help customers feel confident choosing your business."
          : "Public reviews will strengthen credibility as completed, approved review-ready jobs build up.",
      tone: publishedReviewCount > 0 ? "success" : "neutral",
    },
    {
      label: "Public service orders",
      value: String(publicServiceOrderCount),
      detail:
        publicServiceOrderCount > 0
          ? "Public service orders show real completed work and make your business feel more trustworthy."
          : "Public service orders are one of the clearest ways to help customers trust a newer profile.",
      tone: publicServiceOrderCount > 0 ? "success" : "neutral",
    },
  ];

  const nextSteps: VendorGrowthNextStep[] = [];

  if (onboarding?.missingProfileFields?.length) {
    nextSteps.push({
      label: "Complete the missing profile details customers look for",
      detail: `Add the remaining public-facing business details: ${onboarding.missingProfileFields.join(", ")}.`,
      href: "/vendor/profile",
    });
  }

  if (serviceDraftCount === 0) {
    nextSteps.push({
      label: "Create your first service offering",
      detail:
        "A clear service with pricing is the first thing customers need before they can discover your business.",
      href: "/vendor/services",
    });
  } else if (publishedServiceCount === 0) {
    nextSteps.push({
      label: "Get at least one service published",
      detail:
        "Published services offered are what place your business into customer-facing discovery.",
      href: "/vendor/services",
    });
  }

  if (approvedServiceVideoCount === 0) {
    nextSteps.push({
      label: "Move completed work into approved service videos",
      detail:
        "Approved service videos make your business feel real to new customers before they know you.",
      href: "/vendor/jobs",
    });
  }

  if (publishedReviewCount === 0) {
    nextSteps.push({
      label: "Keep the completed-job review loop healthy",
      detail:
        "Published reviews are one of the fastest ways to add customer confidence once service videos and moderation are complete.",
      href: "/vendor/reviews",
    });
  }

  if (
    onboarding?.vendorVisibleToPublic &&
    publishedServiceCount > 0 &&
    !hasInFlightPromotionRequest(promotionRecentRequests)
  ) {
    nextSteps.push({
      label: "Consider a promotion request after your public profile is ready",
      detail:
        "Promotions work best when customers already land on a profile with a published service, Trust Score context, and clear completed-work examples.",
      href: "/vendor/dashboard",
    });
  }

  if (nextSteps.length === 0) {
    nextSteps.push({
      label: "Keep strengthening public trust signals",
      detail:
        "Your business is visible. The next gains come from more approved service videos, more published reviews, and consistent completed work.",
      href: "/vendor/analytics",
    });
  }

  return {
    visibilityTitle,
    visibilityDetail,
    publicProfileHref,
    metrics,
    promotionStatus,
    nextSteps: nextSteps.slice(0, 4),
  };
}
