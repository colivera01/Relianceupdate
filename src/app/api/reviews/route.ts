import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { countableReviewWhere } from '@/lib/metrics-exclusion';

const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveService(review: any): { serviceId: string | null; serviceName: string | null } {
  const bookingService = review?.booking?.service;
  const mediaService = review?.mediaSession?.service;
  return {
    serviceId: bookingService?.id || mediaService?.id || null,
    serviceName: bookingService?.name || mediaService?.name || null,
  };
}

function resolveVendorName(vendor: { businessName?: string | null; name?: string | null } | null | undefined): string | null {
  return vendor?.businessName || vendor?.name || null;
}

/**
 * GET /api/reviews
 * Generic read-only review lookup backed by persisted Review rows.
 *
 * Active customer-owned review UX should prefer /api/reviews/me, and public service
 * pages should prefer /api/services/[id]/reviews/public.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = String(searchParams.get('serviceId') || '').trim();
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const userId = String(searchParams.get('userId') || '').trim();
    const rating = parsePositiveInt(searchParams.get('rating'), 0);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const requestedLimit = parsePositiveInt(searchParams.get('limit'), 10);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const sortBy = String(searchParams.get('sortBy') || 'createdAt');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = countableReviewWhere({
      ...(vendorId ? { vendorId } : {}),
      ...(userId ? { userId } : {}),
      ...(rating >= 1 && rating <= 5 ? { rating } : {}),
      ...(serviceId
        ? {
            OR: [
              { booking: { is: { serviceId } } },
              { mediaSession: { is: { serviceId } } },
            ],
          }
        : {}),
    });

    const orderBy =
      sortBy === 'rating'
        ? { rating: sortOrder }
        : { createdAt: sortOrder };

    const [total, reviews] = await Promise.all([
      (prisma as any).review.count({ where }),
      (prisma as any).review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          vendorId: true,
          bookingId: true,
          mediaSessionId: true,
          rating: true,
          comment: true,
          source: true,
          submittedVia: true,
          moderationStatus: true,
          visibilityStatus: true,
          date: true,
          createdAt: true,
          user: { select: { name: true } },
          vendor: { select: { name: true, businessName: true } },
          booking: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
          mediaSession: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      reviews: reviews.map((review: any) => {
        const service = resolveService(review);
        return {
          id: review.id,
          reviewId: review.id,
          userId: review.userId,
          vendorId: review.vendorId,
          bookingId: review.bookingId,
          mediaSessionId: review.mediaSessionId,
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          vendorName: resolveVendorName(review.vendor),
          reviewerDisplayName: review.user?.name || 'Verified Customer',
          rating: review.rating,
          comment: review.comment || '',
          source: review.source,
          submittedVia: review.submittedVia,
          moderationStatus: review.moderationStatus,
          visibilityStatus: review.visibilityStatus,
          submittedAt: (review.date || review.createdAt)?.toISOString?.() || review.createdAt,
          createdAt: review.createdAt?.toISOString?.() || review.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        routeRole:
          'Generic persisted review lookup. Use /api/reviews/me for customer-owned review hubs and /api/services/[id]/reviews/public for public service display.',
      },
    });
  } catch (error: any) {
    console.error('[reviews] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
        error: 'Generic review creation is retired. Submit customer reviews through the service-video review flow.',
      routeRole: 'Use POST /api/reviews/window/start followed by POST /api/reviews/create.',
    },
    { status: 410 }
  );
}
