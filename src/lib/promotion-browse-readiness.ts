import { prisma } from "@/server/db";
import { countableServiceWhere, countableVendorWhere } from "@/lib/metrics-exclusion";
import { resolvePromotionZoneLimits } from "@/lib/promoted-listings";

export type BrowsePromotionRenderReadiness = {
  organicBrowseCount: number;
  desktopMinimumOrganicCount: number;
  categoryMinimumOrganicCount: number;
  desktopBrowseEligible: boolean;
  categoriesMeetingMinimum: number;
  totalCategoriesWithListings: number;
  categoryCountsByLabel?: Record<string, number>;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBrowsePromotionCategoryLabel(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

export function doesBrowseReadinessMeetCategoryFloor(
  readiness: BrowsePromotionRenderReadiness | null | undefined,
  categoryLabel: unknown
): boolean {
  if (!readiness) return false;
  const normalizedCategoryLabel = normalizeBrowsePromotionCategoryLabel(categoryLabel);
  if (!normalizedCategoryLabel) return false;
  const currentCount = readiness.categoryCountsByLabel?.[normalizedCategoryLabel] || 0;
  return currentCount >= readiness.categoryMinimumOrganicCount;
}

export function serializeBrowsePromotionRenderReadiness(readiness: BrowsePromotionRenderReadiness) {
  return {
    organicBrowseCount: readiness.organicBrowseCount,
    desktopMinimumOrganicCount: readiness.desktopMinimumOrganicCount,
    categoryMinimumOrganicCount: readiness.categoryMinimumOrganicCount,
    desktopBrowseEligible: readiness.desktopBrowseEligible,
    categoriesMeetingMinimum: readiness.categoriesMeetingMinimum,
    totalCategoriesWithListings: readiness.totalCategoriesWithListings,
  };
}

export async function getBrowsePromotionRenderReadiness(): Promise<BrowsePromotionRenderReadiness> {
  const desktopLimits = resolvePromotionZoneLimits("BROWSE_FEATURED", { viewport: "desktop" });
  const categoryLimits = resolvePromotionZoneLimits("BROWSE_FEATURED", {
    hasCategoryFilter: true,
    viewport: "desktop",
  });

  const services = await prisma.service.findMany({
    where: countableServiceWhere({
      isPublished: true,
      vendor: countableVendorWhere({
        isPubliclyListed: true,
        accountStatus: "active",
      }),
    }),
    select: {
      id: true,
      vendor: {
        select: {
          category: true,
          businessType: true,
        },
      },
    },
  });

  const countsByCategory = new Map<string, number>();
  for (const service of services) {
    const categoryLabel =
      normalizeString(service.vendor?.category) ||
      normalizeString(service.vendor?.businessType) ||
      "Uncategorized";
    const normalizedCategoryLabel = normalizeBrowsePromotionCategoryLabel(categoryLabel);
    countsByCategory.set(normalizedCategoryLabel, (countsByCategory.get(normalizedCategoryLabel) || 0) + 1);
  }

  const categoriesMeetingMinimum = Array.from(countsByCategory.values()).filter(
    (count) => count >= categoryLimits.minOrganicResults
  ).length;

  return {
    organicBrowseCount: services.length,
    desktopMinimumOrganicCount: desktopLimits.minOrganicResults,
    categoryMinimumOrganicCount: categoryLimits.minOrganicResults,
    desktopBrowseEligible: services.length >= desktopLimits.minOrganicResults,
    categoriesMeetingMinimum,
    totalCategoriesWithListings: countsByCategory.size,
    categoryCountsByLabel: Object.fromEntries(countsByCategory),
  };
}
