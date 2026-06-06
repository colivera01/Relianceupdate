import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { operationalReviewWhere } from "@/lib/metrics-exclusion";

/**
 * GET /api/admin/reviews/moderation-queue
 * Admin-only review moderation queue.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const moderationStatus = String(searchParams.get("moderationStatus") || "").trim();
    const visibilityStatus = String(searchParams.get("visibilityStatus") || "").trim();
    const vendorId = String(searchParams.get("vendorId") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const date = String(searchParams.get("date") || "").trim();
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = operationalReviewWhere({
      ...(moderationStatus ? { moderationStatus } : {}),
      ...(visibilityStatus ? { visibilityStatus } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { userId: { contains: q } },
              { clientName: { contains: q } },
              { comment: { contains: q } },
              { vendor: { name: { contains: q } } },
              { vendor: { businessName: { contains: q } } },
            ],
          }
        : {}),
    });

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        where.createdAt = { gte: start, lte: end };
      }
    }

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          vendorId: true,
          userId: true,
          clientName: true,
          jobType: true,
          rating: true,
          comment: true,
          createdAt: true,
          moderationStatus: true,
          visibilityStatus: true,
          moderationReason: true,
          moderatedAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
              businessName: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const rows = reviews.map((review) => ({
      reviewId: review.id,
      vendorId: review.vendorId,
      vendorName: review.vendor.businessName || review.vendor.name || null,
      userId: review.userId,
      reviewerName: review.user?.name || review.clientName || null,
      reviewerEmail: review.user?.email || null,
      clientName: review.clientName || null,
      jobType: review.jobType || null,
      rating: review.rating,
      comment: review.comment || "",
      createdAt: review.createdAt,
      moderationStatus: review.moderationStatus,
      visibilityStatus: review.visibilityStatus,
      moderationReason: review.moderationReason,
      moderatedAt: review.moderatedAt,
    }));

    return NextResponse.json({
      success: true,
      message: "Review moderation queue fetched successfully",
      reviews: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      appliedFilters: {
        moderationStatus: moderationStatus || null,
        visibilityStatus: visibilityStatus || null,
        vendorId: vendorId || null,
        q: q || null,
        date: date || null,
      },
    });
  } catch (error: any) {
    console.error("[admin/reviews/moderation-queue] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch review moderation queue", message: "Failed to fetch review moderation queue" },
      { status: 500 }
    );
  }
}
