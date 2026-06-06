import { normalizeAccountStatus } from "@/lib/account-status-shared";
import { distanceMiles, hasValidCoordinates, type Coordinates } from "@/lib/distance";
import { isInternalDemoVendorRecord } from "@/lib/internal-identities";

export const PROMOTION_PLACEMENT_TYPES = ["BROWSE_FEATURED", "HOME_FEATURED"] as const;
export const PROMOTION_TARGET_RADIUS_OPTIONS_MILES = [10, 20, 30] as const;
export const PROMOTION_PAYMENT_STATUSES = [
  "not_started",
  "pending_payment",
  "paid",
  "waived",
  "refunded",
] as const;

export const PROMOTION_PUBLIC_LABEL = "Promoted";
export const PROMOTION_PUBLIC_EXPLAINER =
  "Paid placement from an approved local provider.";
export const PROMOTION_BROWSE_SECTION_TITLE = "Featured local providers";
export const PROMOTION_BROWSE_SECTION_EXPLAINER =
  "Paid placements from approved public vendors. Organic browse results continue below.";
export const PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE =
  "HOME_FEATURED cannot be sold or activated until the public homepage promotion surface is launched.";

export type PromotionZoneKey = (typeof PROMOTION_PLACEMENT_TYPES)[number];
export type PromotionPaymentStatus = (typeof PROMOTION_PAYMENT_STATUSES)[number];

export type PromotionPackageDefinition = {
  packageKey: string;
  name: string;
  publicSummary: string;
  adminDescription: string;
  bestFor: string;
  placementExplanation: string;
  audience: string;
  placementType: PromotionPlacementType;
  durationDays: number;
  defaultRadiusMiles: number;
  maxRadiusMiles: number;
  allowCategoryTargeting: boolean;
  maxConcurrentInZone: number;
  defaultPriceCents: number;
  isActive: boolean;
  isFoundingRate: boolean;
  pricingLabel: string;
};

export type PromotionPackageSnapshot = {
  packageKey: string;
  name: string;
  publicSummary: string;
  adminDescription: string;
  placementType: PromotionPlacementType;
  durationDays: number;
  targetRadiusMiles: number;
  maxRadiusMiles: number;
  allowCategoryTargeting: boolean;
  priceCents: number;
  isFoundingRate: boolean;
  pricingLabel: string;
  bestFor: string;
  placementExplanation: string;
  audience: string;
};

export type PromotionZoneInventoryPolicy = {
  placementType: PromotionPlacementType;
  maxSlotsDesktop: number;
  maxSlotsMobile: number;
  minOrganicResults: number;
  categoryFilter?: {
    maxSlotsDesktop: number;
    maxSlotsMobile: number;
    minOrganicResults: number;
  };
};

/** Implementation-ready zone caps for Phase 2 paid placement (HOME not rendered yet). */
export const PROMOTION_ZONE_INVENTORY: Record<PromotionZoneKey, PromotionZoneInventoryPolicy> = {
  BROWSE_FEATURED: {
    placementType: "BROWSE_FEATURED",
    maxSlotsDesktop: 2,
    maxSlotsMobile: 1,
    minOrganicResults: 4,
    categoryFilter: {
      maxSlotsDesktop: 1,
      maxSlotsMobile: 1,
      minOrganicResults: 3,
    },
  },
  HOME_FEATURED: {
    placementType: "HOME_FEATURED",
    maxSlotsDesktop: 1,
    maxSlotsMobile: 1,
    minOrganicResults: 6,
  },
};

export const PROMOTION_PACKAGES = [
  {
    packageKey: "browse-local-7-day",
    name: "7-day local spotlight",
    publicSummary: "Entry-level browse feature for one local service area.",
    adminDescription:
      "Best for a quick launch push, testing promoted browse demand, or giving a qualified vendor short-term visibility.",
    bestFor: "Entry-level local visibility and launch-week experiments.",
    placementExplanation: "Appears in the Featured local providers section on browse.",
    audience: "Local vendors who want a low-commitment featured browse placement.",
    placementType: "BROWSE_FEATURED",
    durationDays: 7,
    defaultRadiusMiles: 10,
    maxRadiusMiles: 10,
    allowCategoryTargeting: true,
    maxConcurrentInZone: 2,
    defaultPriceCents: 2900,
    isActive: true,
    isFoundingRate: true,
    pricingLabel: "Founding / intro rate",
  },
  {
    packageKey: "browse-local-30-day",
    name: "30-day local spotlight",
    publicSummary: "Month-long browse feature for broader local coverage.",
    adminDescription:
      "Best for vendors ready for a longer local campaign while Reliance is still proving early marketplace volume.",
    bestFor: "Sustained local visibility and stronger package-popularity signal.",
    placementExplanation: "Appears in browse with up to 30 miles of radius targeting.",
    audience: "Established local vendors who want a longer promoted listing run.",
    placementType: "BROWSE_FEATURED",
    durationDays: 30,
    defaultRadiusMiles: 20,
    maxRadiusMiles: 30,
    allowCategoryTargeting: true,
    maxConcurrentInZone: 2,
    defaultPriceCents: 8900,
    isActive: true,
    isFoundingRate: true,
    pricingLabel: "Founding / intro rate",
  },
  {
    packageKey: "home-spotlight-7-day",
    name: "7-day homepage spotlight",
    publicSummary: "Premium homepage spotlight reservation for top visibility.",
    adminDescription:
      "Premium inventory foundation for later homepage rendering; sell carefully until the public home placement is live.",
    bestFor: "Premium brand visibility and limited homepage inventory.",
    placementExplanation: "Reserved for HOME_FEATURED inventory; public homepage rendering is still deferred.",
    audience: "High-priority vendors suited for premium placement.",
    placementType: "HOME_FEATURED",
    durationDays: 7,
    defaultRadiusMiles: 20,
    maxRadiusMiles: 30,
    allowCategoryTargeting: false,
    maxConcurrentInZone: 1,
    defaultPriceCents: 9900,
    isActive: false,
    isFoundingRate: true,
    pricingLabel: "Founding / intro rate",
  },
] as const satisfies readonly PromotionPackageDefinition[];

export const PROMOTION_DISALLOWED_SURFACES = [
  "booking flow",
  "booking confirmation",
  "consent flow",
  "customer service video pages",
  "review submission flow",
  "vendor/admin internal tools",
  "search results injection between organic rows",
  "vendor job execution surfaces",
] as const;
export const PROMOTION_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
  "rejected",
  "expired",
  "cancelled",
] as const;

export type PromotionPlacementType = (typeof PROMOTION_PLACEMENT_TYPES)[number];
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

const PLACEMENT_TYPE_SET = new Set<string>(PROMOTION_PLACEMENT_TYPES);
const STATUS_SET = new Set<string>(PROMOTION_STATUSES);
const PAYMENT_STATUS_SET = new Set<string>(PROMOTION_PAYMENT_STATUSES);
const RADIUS_OPTION_SET = new Set<number>(PROMOTION_TARGET_RADIUS_OPTIONS_MILES);

function packageMap(
  definitions: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES
): Map<string, PromotionPackageDefinition> {
  return new Map(definitions.map((definition) => [definition.packageKey, definition]));
}

export function normalizePromotionPlacementType(value: unknown): PromotionPlacementType {
  const normalized = String(value || "").trim().toUpperCase();
  return PLACEMENT_TYPE_SET.has(normalized) ? (normalized as PromotionPlacementType) : "BROWSE_FEATURED";
}

export function isPromotionPlacementLaunched(value: unknown): boolean {
  return normalizePromotionPlacementType(value) === "BROWSE_FEATURED";
}

export function normalizePromotionStatus(value: unknown): PromotionStatus {
  const normalized = String(value || "").trim().toLowerCase();
  return STATUS_SET.has(normalized) ? (normalized as PromotionStatus) : "draft";
}

export function normalizePromotionPaymentStatus(value: unknown): PromotionPaymentStatus {
  const normalized = String(value || "").trim().toLowerCase();
  return PAYMENT_STATUS_SET.has(normalized) ? (normalized as PromotionPaymentStatus) : "not_started";
}

export function isPromotionPaymentAcceptable(value: unknown): boolean {
  const paymentStatus = normalizePromotionPaymentStatus(value);
  return paymentStatus === "paid" || paymentStatus === "waived";
}

export function doesPromotionPaymentNeedReference(value: unknown): boolean {
  return normalizePromotionPaymentStatus(value) === "paid";
}

export function normalizePromotionPackageKey(
  value: unknown,
  definitions: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES
): string {
  const packageKey = String(value || "").trim();
  const packages = definitions.length ? definitions : PROMOTION_PACKAGES;
  return packageMap(packages).has(packageKey) ? packageKey : packages[0].packageKey;
}

export function getPromotionPackageDefinition(
  value: unknown,
  definitions: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES
): PromotionPackageDefinition {
  const packages = definitions.length ? definitions : PROMOTION_PACKAGES;
  return packageMap(packages).get(normalizePromotionPackageKey(value, packages)) || packages[0];
}

export function normalizePromotionTargetRadiusMiles(
  value: unknown,
  fallback: number = PROMOTION_PACKAGES[0].defaultRadiusMiles
): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && RADIUS_OPTION_SET.has(parsed)) {
    return parsed;
  }
  return RADIUS_OPTION_SET.has(fallback) ? fallback : PROMOTION_PACKAGES[0].defaultRadiusMiles;
}

export function getPromotionReservationLimit(
  packageKey: unknown,
  placementType: unknown,
  definitions: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES
): number {
  const packageDefinition = getPromotionPackageDefinition(packageKey, definitions);
  const zone = normalizePromotionPlacementType(placementType);
  const zoneLimit = PROMOTION_ZONE_INVENTORY[zone].maxSlotsDesktop;
  return Math.min(zoneLimit, packageDefinition.maxConcurrentInZone);
}

export function doesPromotionReserveInventory(campaign: { status?: unknown }): boolean {
  const status = normalizePromotionStatus(campaign.status);
  return status === "scheduled" || status === "active";
}

export function validatePromotionPackageRules(input: {
  packageKey: unknown;
  placementType: unknown;
  startAt: Date | string;
  endAt: Date | string;
  targetRadiusMiles: unknown;
  targetCategory?: unknown;
  packageDefinitions?: readonly PromotionPackageDefinition[];
}): string | null {
  const packageDefinition = getPromotionPackageDefinition(input.packageKey, input.packageDefinitions);
  const placementType = normalizePromotionPlacementType(input.placementType);
  if (!isPromotionPlacementLaunched(placementType)) {
    return PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE;
  }
  if (placementType !== packageDefinition.placementType) {
    return `${packageDefinition.name} can only use ${packageDefinition.placementType} placement.`;
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  const durationMs = endAt.getTime() - startAt.getTime();
  const maxDurationMs = packageDefinition.durationDays * 24 * 60 * 60 * 1000;
  if (Number.isFinite(durationMs) && durationMs > maxDurationMs) {
    return `${packageDefinition.name} can run for at most ${packageDefinition.durationDays} days.`;
  }

  const targetRadiusMiles = normalizePromotionTargetRadiusMiles(
    input.targetRadiusMiles,
    packageDefinition.defaultRadiusMiles
  );
  if (targetRadiusMiles > packageDefinition.maxRadiusMiles) {
    return `${packageDefinition.name} supports a maximum radius of ${packageDefinition.maxRadiusMiles} miles.`;
  }

  if (!packageDefinition.allowCategoryTargeting && String(input.targetCategory || "").trim()) {
    return `${packageDefinition.name} does not include category targeting.`;
  }

  return null;
}

export function createPromotionPackageSnapshot(
  packageDefinition: PromotionPackageDefinition,
  input?: { targetRadiusMiles?: unknown; priceCents?: unknown }
): PromotionPackageSnapshot {
  const targetRadiusMiles = normalizePromotionTargetRadiusMiles(
    input?.targetRadiusMiles,
    packageDefinition.defaultRadiusMiles
  );
  const parsedPrice = Number(input?.priceCents);
  const priceCents =
    Number.isFinite(parsedPrice) && parsedPrice >= 0
      ? Math.round(parsedPrice)
      : packageDefinition.defaultPriceCents;

  return {
    packageKey: packageDefinition.packageKey,
    name: packageDefinition.name,
    publicSummary: packageDefinition.publicSummary,
    adminDescription: packageDefinition.adminDescription,
    placementType: packageDefinition.placementType,
    durationDays: packageDefinition.durationDays,
    targetRadiusMiles,
    maxRadiusMiles: packageDefinition.maxRadiusMiles,
    allowCategoryTargeting: packageDefinition.allowCategoryTargeting,
    priceCents,
    isFoundingRate: packageDefinition.isFoundingRate,
    pricingLabel: packageDefinition.pricingLabel,
    bestFor: packageDefinition.bestFor,
    placementExplanation: packageDefinition.placementExplanation,
    audience: packageDefinition.audience,
  };
}

export function serializePromotionPackageSnapshot(snapshot: PromotionPackageSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parsePromotionPackageSnapshot(value: unknown): PromotionPackageSnapshot | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PromotionPackageSnapshot>;
    if (!parsed || typeof parsed !== "object" || !parsed.packageKey || !parsed.name) {
      return null;
    }
    return {
      packageKey: String(parsed.packageKey),
      name: String(parsed.name),
      publicSummary: String(parsed.publicSummary || ""),
      adminDescription: String(parsed.adminDescription || ""),
      placementType: normalizePromotionPlacementType(parsed.placementType),
      durationDays: Number(parsed.durationDays || 0),
      targetRadiusMiles: normalizePromotionTargetRadiusMiles(parsed.targetRadiusMiles),
      maxRadiusMiles: Number(parsed.maxRadiusMiles || 0),
      allowCategoryTargeting: parsed.allowCategoryTargeting === true,
      priceCents: Number(parsed.priceCents || 0),
      isFoundingRate: parsed.isFoundingRate === true,
      pricingLabel: String(parsed.pricingLabel || ""),
      bestFor: String(parsed.bestFor || ""),
      placementExplanation: String(parsed.placementExplanation || ""),
      audience: String(parsed.audience || ""),
    };
  } catch {
    return null;
  }
}

export function isVendorPromotionEligible(vendor: {
  id?: string | null;
  demo?: boolean | null;
  isPubliclyListed?: boolean | null;
  accountStatus?: unknown;
} | null | undefined): boolean {
  if (!vendor) return false;
  if (isInternalDemoVendorRecord(vendor)) return false;
  return Boolean(
    vendor.isPubliclyListed === true && normalizeAccountStatus(vendor.accountStatus) === "active"
  );
}

export function isServicePromotionEligible(service: {
  isPublished?: boolean | null;
  vendor?: {
    isPubliclyListed?: boolean | null;
    accountStatus?: unknown;
  } | null;
} | null | undefined): boolean {
  return Boolean(service?.isPublished === true && isVendorPromotionEligible(service.vendor));
}

export function isCampaignCurrentlyRenderable(campaign: {
  status?: unknown;
  paymentStatus?: unknown;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  service?: {
    isPublished?: boolean | null;
    vendor?: {
      isPubliclyListed?: boolean | null;
      accountStatus?: unknown;
    } | null;
  } | null;
}, now = new Date()): boolean {
  const startAt = campaign.startAt ? new Date(campaign.startAt) : null;
  const endAt = campaign.endAt ? new Date(campaign.endAt) : null;
  return Boolean(
    normalizePromotionStatus(campaign.status) === "active" &&
      isPromotionPaymentAcceptable(campaign.paymentStatus) &&
      startAt &&
      endAt &&
      startAt <= now &&
      endAt >= now &&
      isServicePromotionEligible(campaign.service)
  );
}

export function promotionEligibilityNote(): string {
  return "Promoted placement requires an active vendor, public vendor listing, published service, active campaign status, paid or waived payment status, an available reserved slot, and a current date window.";
}

export function resolvePromotionZoneLimits(
  zone: PromotionZoneKey,
  options?: { hasCategoryFilter?: boolean; viewport?: "desktop" | "mobile" }
): { maxSlots: number; minOrganicResults: number } {
  const policy = PROMOTION_ZONE_INVENTORY[zone];
  const categoryScoped = options?.hasCategoryFilter && policy.categoryFilter;
  const scoped = categoryScoped ? policy.categoryFilter! : policy;
  const maxSlots =
    options?.viewport === "mobile" ? scoped.maxSlotsMobile : scoped.maxSlotsDesktop;
  const minOrganicResults = scoped.minOrganicResults;
  return { maxSlots, minOrganicResults };
}

type PromotionInventoryCandidate = {
  serviceId: string;
  vendorId: string;
};

export function applyPromotionInventoryRules<T extends PromotionInventoryCandidate>(
  candidates: T[],
  options: {
    zone: PromotionZoneKey;
    organicResultCount: number;
    hasCategoryFilter?: boolean;
  }
): T[] {
  const { maxSlots, minOrganicResults } = resolvePromotionZoneLimits(options.zone, {
    hasCategoryFilter: options.hasCategoryFilter,
    viewport: "desktop",
  });

  if (options.organicResultCount < minOrganicResults || maxSlots <= 0) {
    return [];
  }

  const seenServiceIds = new Set<string>();
  const seenVendorIds = new Set<string>();
  const selected: T[] = [];

  for (const candidate of candidates) {
    if (seenServiceIds.has(candidate.serviceId) || seenVendorIds.has(candidate.vendorId)) {
      continue;
    }
    seenServiceIds.add(candidate.serviceId);
    seenVendorIds.add(candidate.vendorId);
    selected.push(candidate);
    if (selected.length >= maxSlots) {
      break;
    }
  }

  return selected;
}

export function campaignMatchesTargetRadius(
  campaign: {
    targetRadiusMiles?: unknown;
    service?: {
      vendor?: {
        latitude?: unknown;
        longitude?: unknown;
        geocodedAt?: unknown;
      } | null;
    } | null;
  },
  origin: Coordinates | null
): boolean {
  if (!origin) {
    return true;
  }

  const vendor = campaign.service?.vendor;
  if (!vendor?.geocodedAt || !hasValidCoordinates(vendor)) {
    return false;
  }

  const radiusMiles = normalizePromotionTargetRadiusMiles(campaign.targetRadiusMiles);
  return distanceMiles(origin, vendor) <= radiusMiles;
}
