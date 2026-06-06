import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { cleanPublicServiceDescription } from "@/lib/launch-content-cleanup";
import {
  countableServiceWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";

type SearchType = "service" | "vendor" | null;
type SortBy = "relevance" | "price" | "rating" | "distance";
type SortOrder = "asc" | "desc";

const SPECIAL_SUGGESTION_QUERIES = new Set(["popular", "trending", "filters"]);

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalNumber(value: string | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSearchType(value: string | null): SearchType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "service") return "service";
  if (normalized === "vendor") return "vendor";
  return null;
}

function normalizeSortBy(value: string | null): SortBy {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "price") return "price";
  if (normalized === "rating") return "rating";
  if (normalized === "distance") return "distance";
  return "relevance";
}

function normalizeSortOrder(value: string | null): SortOrder {
  return String(value || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeCategoryKey(value: string | null) {
  return String(value || "").trim();
}

function normalizeLocationKey(value: string | null) {
  return String(value || "").trim();
}

function scoreQueryMatch(text: string, query: string) {
  if (!query) return 0;
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (!normalizedText) return 0;
  if (normalizedText === normalizedQuery) return 1;
  if (normalizedText.startsWith(normalizedQuery)) return 0.9;
  if (normalizedText.includes(normalizedQuery)) return 0.75;
  return 0;
}

function clampRelevance(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = String(searchParams.get("q") || "").trim();
    const category = normalizeCategoryKey(searchParams.get("category"));
    const location = normalizeLocationKey(searchParams.get("location"));
    const priceMin = parseOptionalNumber(searchParams.get("priceMin"));
    const priceMax = parseOptionalNumber(searchParams.get("priceMax"));
    const ratingMin = parseOptionalNumber(searchParams.get("rating"));
    const type = normalizeSearchType(searchParams.get("type"));
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInteger(searchParams.get("limit"), 20), 50);
    const sortBy = normalizeSortBy(searchParams.get("sortBy"));
    const sortOrder = normalizeSortOrder(searchParams.get("sortOrder"));

    if (!rawQuery && !category && !location) {
      return NextResponse.json(
        { error: "Search query, category, or location is required" },
        { status: 400 }
      );
    }

    const specialSuggestionMode = SPECIAL_SUGGESTION_QUERIES.has(rawQuery.toLowerCase());
    const effectiveQuery = specialSuggestionMode ? "" : rawQuery;
    const skip = (page - 1) * limit;

    const vendorBaseClauses: any[] = [];
    if (category) {
      vendorBaseClauses.push({
        OR: [{ category }, { businessType: category }],
      });
    }
    if (location) {
      vendorBaseClauses.push({
        OR: [
          { city: { contains: location } },
          { state: { contains: location } },
          { zipCode: { contains: location } },
        ],
      });
    }

    const vendorBaseWhere = countableVendorWhere({
      isPubliclyListed: true,
      accountStatus: "active",
      ...(vendorBaseClauses.length ? { AND: vendorBaseClauses } : {}),
    });

    const vendorWhere = countableVendorWhere({
      isPubliclyListed: true,
      accountStatus: "active",
      ...(vendorBaseClauses.length || effectiveQuery
        ? {
            AND: [
              ...vendorBaseClauses,
              ...(effectiveQuery
                ? [
                    {
                      OR: [
                        { name: { contains: effectiveQuery } },
                        { businessName: { contains: effectiveQuery } },
                        { category: { contains: effectiveQuery } },
                        { businessType: { contains: effectiveQuery } },
                        { city: { contains: effectiveQuery } },
                        { state: { contains: effectiveQuery } },
                      ],
                    },
                  ]
                : []),
            ],
          }
        : {}),
    });

    const serviceWhere = countableServiceWhere({
      isPublished: true,
      ...(priceMin != null ? { price: { gte: priceMin } } : {}),
      ...(priceMax != null
        ? {
            price: {
              ...(priceMin != null ? { gte: priceMin } : {}),
              lte: priceMax,
            },
          }
        : {}),
      vendor: vendorBaseWhere,
      ...(effectiveQuery
        ? {
            OR: [
              { name: { contains: effectiveQuery } },
              { description: { contains: effectiveQuery } },
              { vendor: { name: { contains: effectiveQuery } } },
              { vendor: { businessName: { contains: effectiveQuery } } },
              { vendor: { category: { contains: effectiveQuery } } },
              { vendor: { businessType: { contains: effectiveQuery } } },
            ],
          }
        : {}),
    });

    const [services, vendors] = await Promise.all([
      prisma.service.findMany({
        where: serviceWhere,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          createdAt: true,
          vendorId: true,
          vendor: {
            select: {
              id: true,
              name: true,
              businessName: true,
              category: true,
              businessType: true,
              city: true,
              state: true,
            },
          },
        },
      }),
      prisma.vendor.findMany({
        where: vendorWhere,
        select: {
          id: true,
          name: true,
          businessName: true,
          category: true,
          businessType: true,
          city: true,
          state: true,
          foundedYear: true,
          createdAt: true,
          _count: {
            select: {
              services: true,
            },
          },
        },
      }),
    ]);

    const vendorIds = Array.from(
      new Set([
        ...vendors.map((vendor) => String(vendor.id)),
        ...services.map((service) => String(service.vendorId)),
      ])
    );
    const vendorReviewAggregates = await getVendorReviewAggregatesForPublic(vendorIds);

    const mappedServices = services
      .map((service) => {
        const vendorName = service.vendor.businessName || service.vendor.name || "Unknown Vendor";
        const locationLabel = [service.vendor.city, service.vendor.state]
          .filter(Boolean)
          .join(", ");
        const vendorStats = vendorReviewAggregates.get(String(service.vendorId));
        const relevance = effectiveQuery
          ? clampRelevance(
              Math.max(
                scoreQueryMatch(service.name, effectiveQuery),
                scoreQueryMatch(service.description || "", effectiveQuery) * 0.95,
                scoreQueryMatch(vendorName, effectiveQuery) * 0.9,
                scoreQueryMatch(service.vendor.category || "", effectiveQuery) * 0.75
              )
            )
          : 0.5;

        return {
          id: String(service.id),
          name: service.name,
          description: cleanPublicServiceDescription(service.description || "", vendorName),
          category: service.vendor.category || service.vendor.businessType || "General",
          price: Number(service.price),
          rating: vendorStats?.rating ?? null,
          vendor: {
            id: String(service.vendorId),
            name: vendorName,
            rating: vendorStats?.rating ?? null,
            verified: null,
            location: locationLabel || null,
            distance: null,
          },
          relevance_score: relevance,
          createdAt: service.createdAt,
        };
      })
      .filter((service) => (ratingMin != null ? (service.rating ?? 0) >= ratingMin : true));

    const mappedVendors = vendors
      .map((vendor) => {
        const vendorName = vendor.businessName || vendor.name || "Unknown Vendor";
        const locationLabel = [vendor.city, vendor.state].filter(Boolean).join(", ");
        const vendorStats = vendorReviewAggregates.get(String(vendor.id));
        const relevance = effectiveQuery
          ? clampRelevance(
              Math.max(
                scoreQueryMatch(vendorName, effectiveQuery),
                scoreQueryMatch(vendor.category || "", effectiveQuery) * 0.8,
                scoreQueryMatch(vendor.businessType || "", effectiveQuery) * 0.75,
                scoreQueryMatch(locationLabel, effectiveQuery) * 0.7
              )
            )
          : 0.5;

        return {
          id: String(vendor.id),
          name: vendorName,
          category: vendor.category || vendor.businessType || "General",
          rating: vendorStats?.rating ?? null,
          review_count: vendorStats?.reviewCount ?? 0,
          verified: null,
          location: locationLabel || null,
          distance: null,
          services_count: Number(vendor._count?.services || 0),
          years_in_business:
            vendor.foundedYear && Number.isFinite(vendor.foundedYear)
              ? Math.max(0, new Date().getFullYear() - vendor.foundedYear)
              : null,
          relevance_score: relevance,
          createdAt: vendor.createdAt,
        };
      })
      .filter((vendor) => (ratingMin != null ? (vendor.rating ?? 0) >= ratingMin : true));

    const sortFactor = sortOrder === "asc" ? 1 : -1;
    const sortByCreatedAtDesc = (a: { createdAt: Date }, b: { createdAt: Date }) =>
      b.createdAt.getTime() - a.createdAt.getTime();

    mappedServices.sort((a, b) => {
      if (sortBy === "price") return (a.price - b.price) * sortFactor;
      if (sortBy === "rating") return (((a.rating ?? 0) - (b.rating ?? 0)) * sortFactor);
      if (sortBy === "distance") return 0;
      if (effectiveQuery) return ((a.relevance_score - b.relevance_score) * sortFactor * -1);
      return sortByCreatedAtDesc(a, b);
    });

    mappedVendors.sort((a, b) => {
      if (sortBy === "rating") return (((a.rating ?? 0) - (b.rating ?? 0)) * sortFactor);
      if (sortBy === "distance") return 0;
      if (effectiveQuery) return ((a.relevance_score - b.relevance_score) * sortFactor * -1);
      return sortByCreatedAtDesc(a, b);
    });

    const pagedServices = type === "vendor" ? [] : mappedServices.slice(skip, skip + limit);
    const pagedVendors = type === "service" ? [] : mappedVendors.slice(skip, skip + limit);

    const categoryCounts = new Map<string, number>();
    for (const service of mappedServices) {
      const key = String(service.category || "").trim();
      if (!key) continue;
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    }

    const priceRanges = [
      { min: 0, max: 50 },
      { min: 50, max: 100 },
      { min: 100, max: 200 },
      { min: 200, max: 500 },
      { min: 500, max: null },
    ].map((range) => ({
      ...range,
      count: mappedServices.filter((service) =>
        range.max == null
          ? service.price >= range.min
          : service.price >= range.min && service.price <= range.max
      ).length,
    }));

    const ratingBuckets = [5, 4, 3, 2, 1].map((bucket) => ({
      rating: bucket,
      count:
        mappedServices.filter((service) => (service.rating ?? 0) >= bucket).length +
        mappedVendors.filter((vendor) => (vendor.rating ?? 0) >= bucket).length,
    }));

    const suggestionPool = [
      ...mappedServices.map((service) => service.name),
      ...mappedVendors.map((vendor) => vendor.name),
      ...Array.from(categoryCounts.keys()),
    ];
    const normalizedSuggestions = Array.from(
      new Map(
        suggestionPool
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .map((value) => [value.toLowerCase(), value] as const)
      ).values()
    );
    const suggestions = normalizedSuggestions
      .filter((value) =>
        effectiveQuery ? value.toLowerCase().includes(effectiveQuery.toLowerCase()) : true
      )
      .slice(0, limit);

    const flattenedResults = [
      ...pagedServices.map((service) => ({
        id: service.id,
        type: "service" as const,
        title: service.name,
        description: service.description,
        rating: service.rating ?? undefined,
        price: service.price,
        location: service.vendor.location || undefined,
        relevance: service.relevance_score,
      })),
      ...pagedVendors.map((vendor) => ({
        id: vendor.id,
        type: "vendor" as const,
        title: vendor.name,
        description: `${vendor.category} vendor`,
        rating: vendor.rating ?? undefined,
        location: vendor.location || undefined,
        relevance: vendor.relevance_score,
      })),
    ].sort((a, b) => b.relevance - a.relevance);

    const total =
      type === "service"
        ? mappedServices.length
        : type === "vendor"
        ? mappedVendors.length
        : mappedServices.length + mappedVendors.length;

    return NextResponse.json({
      results: flattenedResults,
      services: pagedServices,
      vendors: pagedVendors,
      suggestions,
      filters: {
        categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count })),
        price_ranges: priceRanges,
        ratings: ratingBuckets,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error performing search:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
