import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  countableReviewWhere,
  countableServiceWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import { canonicalPublicWrittenReviewWhere } from "@/lib/review-rating-validity";
import {
  cleanPublicReviewComment,
  cleanPublicServiceName,
} from "@/lib/launch-content-cleanup";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

type ReviewSort = "newest" | "oldest";

function toPublicReviewerDisplayName(name: string | null | undefined): string | null {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function parsePositiveInt(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parseRating(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : Number.NaN;
}

function parseDateBoundary(value: string | null, endOfDay: boolean): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = new Date(dateOnly ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * GET /api/vendors/[vendorId]/reviews/public
 * Paginated, public-safe Vendor written reviews with canonical Service attribution.
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const { searchParams } = new URL(request.url);
    const requestedPage = parsePositiveInt(searchParams.get("page"), 1, 100_000);
    const limit = parsePositiveInt(searchParams.get("limit"), 3, 50);
    const rating = parseRating(searchParams.get("rating"));
    const serviceId = String(searchParams.get("serviceId") || "").trim();
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = parseDateBoundary(fromRaw, false);
    const to = parseDateBoundary(toRaw, true);
    const sort: ReviewSort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

    if (Number.isNaN(rating)) {
      return NextResponse.json({ success: false, error: "rating must be an integer from 1 to 5" }, { status: 400 });
    }
    if (fromRaw && !from) {
      return NextResponse.json({ success: false, error: "from must be a valid date" }, { status: 400 });
    }
    if (toRaw && !to) {
      return NextResponse.json({ success: false, error: "to must be a valid date" }, { status: 400 });
    }
    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json({ success: false, error: "from must be on or before to" }, { status: 400 });
    }

    const vendor = await withTransientDbRetry(() =>
      prisma.vendor.findFirst({
        where: countableVendorWhere({ id: vendorId, isPubliclyListed: true, accountStatus: "active" }),
        select: { id: true, name: true, businessName: true },
      })
    );

    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    if (serviceId) {
      const service = await withTransientDbRetry(() =>
        prisma.service.findFirst({
          where: countableServiceWhere({ id: serviceId, vendorId: vendor.id, isPublished: true }),
          select: { id: true },
        })
      );
      if (!service) {
        return NextResponse.json({ success: false, error: "Service not found for this vendor" }, { status: 404 });
      }
    }

    const where = countableReviewWhere({
      vendorId: vendor.id,
      ...canonicalPublicWrittenReviewWhere(),
      ...(rating ? { rating } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(serviceId
        ? {
            OR: [
              { booking: { is: { serviceId } } },
              { mediaSession: { is: { serviceId } } },
            ],
          }
        : {}),
    });

    const total = await withTransientDbRetry(() => prisma.review.count({ where }));
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
    const reviews = await withTransientDbRetry(() =>
      prisma.review.findMany({
        where,
        orderBy: [
          { createdAt: sort === "oldest" ? "asc" : "desc" },
          { id: sort === "oldest" ? "asc" : "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          vendorId: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true } },
          booking: { select: { service: { select: { id: true, name: true } } } },
          mediaSession: { select: { service: { select: { id: true, name: true } } } },
        },
      })
    );

    const publicVendorName = vendor.businessName || vendor.name;
    return NextResponse.json({
      success: true,
      reviews: reviews.map((review) => {
        const service = review.booking?.service || review.mediaSession?.service || null;
        return {
          reviewId: review.id,
          vendorId: review.vendorId,
          serviceId: service?.id || null,
          serviceName: service ? cleanPublicServiceName(service.name, publicVendorName) : null,
          rating: review.rating,
          comment: cleanPublicReviewComment(review.comment),
          createdAt: review.createdAt,
          reviewerDisplayName: toPublicReviewerDisplayName(review.user?.name) || "Verified Customer",
        };
      }),
      pagination: { page, limit, total, totalPages },
      filters: {
        rating,
        serviceId: serviceId || null,
        from: fromRaw || null,
        to: toRaw || null,
        sort,
      },
      meta: {
        eligibilityRule:
          "Only approved Public written comments from verified Customer Reviews for active publicly listed Vendors are returned.",
      },
    });
  } catch (error: any) {
    console.error("[vendors/:vendorId/reviews/public] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        { success: false, code: PUBLIC_DB_UNAVAILABLE_CODE, error: PUBLIC_DB_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch public vendor reviews", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
