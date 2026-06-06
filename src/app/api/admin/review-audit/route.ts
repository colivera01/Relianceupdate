import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';
import { launchExcludedUserIds, launchExcludedVendorIds } from '@/lib/internal-identities';
import { deriveReviewWindowLifecycleTruth } from '@/lib/review-window-lifecycle';

function buildBookingWhere(customer: string, consentStatus: string) {
  const bookingWhere: any = {};

  if (customer) {
    bookingWhere.OR = [
      { userId: { contains: customer } },
      { user: { email: { contains: customer } } },
      { user: { phone: { contains: customer } } },
    ];
  }

  if (consentStatus) {
    bookingWhere.consentRecords = { some: { status: consentStatus } };
  }

  return Object.keys(bookingWhere).length ? bookingWhere : undefined;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const reviewWindowId = String(searchParams.get('reviewWindowId') || '').trim();
    const bookingId = String(searchParams.get('bookingId') || '').trim();
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const customer = String(searchParams.get('customer') || '').trim();
    const reviewWindowStatus = String(searchParams.get('reviewWindowStatus') || '').trim();
    const sentiment = String(searchParams.get('sentiment') || '').trim();
    const consentStatus = String(searchParams.get('consentStatus') || '').trim();
    const dateFrom = String(searchParams.get('dateFrom') || '').trim();
    const dateTo = String(searchParams.get('dateTo') || '').trim();
    const includeInternal = String(searchParams.get('includeInternal') || '').trim() === '1';
    const includeDetails = String(searchParams.get('includeDetails') || '').trim() === '1';
    const includeTotal = String(searchParams.get('includeTotal') || '').trim() === '1';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const bookingWhere = buildBookingWhere(customer, consentStatus);
    const where: any = {
      ...(reviewWindowId ? { id: reviewWindowId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(reviewWindowStatus ? { status: reviewWindowStatus } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(bookingWhere ? { booking: bookingWhere } : {}),
      ...(sentiment ? { sentiments: { some: { sentiment } } } : {}),
    };

    if (!includeInternal) {
      where.NOT = [
        { vendorId: { in: launchExcludedVendorIds() } },
        { booking: { userId: { in: launchExcludedUserIds() } } },
      ];
    }

    const rowInclude = includeDetails
      ? {
          booking: {
            select: {
              id: true,
              userId: true,
              status: true,
              user: { select: { email: true, phone: true, name: true } },
              reviews: {
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'desc' as const },
                take: 1,
              },
              mediaSessions: {
                where: { sessionType: 'JOB_SERVICE_VIDEO' },
                select: {
                  vendorJobVideoStage: true,
                  mediaAssets: {
                    select: {
                      mimeType: true,
                      moderationStatus: true,
                      visibilityStatus: true,
                      archiveStatus: true,
                    },
                  },
                },
              },
            },
          },
          vendor: { select: { id: true, name: true, businessName: true } },
          mediaSession: { select: { id: true, status: true, title: true } },
          review: { select: { id: true, rating: true, comment: true, submittedVia: true, createdAt: true } },
          sentiments: { orderBy: { createdAt: 'asc' as const } },
          promptEvents: { orderBy: { createdAt: 'asc' as const } },
        }
      : {
          booking: {
            select: {
              id: true,
              userId: true,
              status: true,
              user: { select: { email: true, phone: true, name: true } },
              reviews: {
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'desc' as const },
                take: 1,
              },
              mediaSessions: {
                where: { sessionType: 'JOB_SERVICE_VIDEO' },
                select: {
                  vendorJobVideoStage: true,
                  mediaAssets: {
                    select: {
                      mimeType: true,
                      moderationStatus: true,
                      visibilityStatus: true,
                      archiveStatus: true,
                    },
                  },
                },
              },
            },
          },
          vendor: { select: { id: true, name: true, businessName: true } },
        };

    const [total, reviewWindows] = await Promise.all([
      includeTotal ? (prisma as any).reviewWindow.count({ where }) : Promise.resolve(null),
      (prisma as any).reviewWindow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: includeDetails && reviewWindowId ? 1 : limit,
        include: rowInclude,
      }),
    ]);

    let consentByBooking = new Map<string, any[]>();
    if (includeDetails && reviewWindows.length > 0) {
      const bookingIds = Array.from(new Set(reviewWindows.map((windowRow: any) => String(windowRow.bookingId)).filter(Boolean)));
      const consentRecords = await (prisma as any).consentRecord.findMany({
        where: { bookingId: { in: bookingIds } },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      consentByBooking = new Map<string, any[]>();
      for (const consent of consentRecords) {
        const key = String(consent.bookingId);
        if (!consentByBooking.has(key)) consentByBooking.set(key, []);
        consentByBooking.get(key)!.push(consent);
      }
    }

    const rows = reviewWindows.map((windowRow: any) => {
      const hasSubmittedReview =
        Boolean(windowRow.review?.id) ||
        (Array.isArray(windowRow.booking?.reviews) && windowRow.booking.reviews.length > 0);
      const lifecycleTruth = deriveReviewWindowLifecycleTruth({
        bookingStatus: windowRow.booking?.status,
        mediaSessions: windowRow.booking?.mediaSessions || [],
        hasSubmittedReview,
        reviewWindows: [{ status: windowRow.status }],
      });
      const baseRow: any = {
        reviewWindowId: windowRow.id,
        status: windowRow.status,
        effectiveStatus: lifecycleTruth.effectiveStatus,
        lifecycleNote: lifecycleTruth.lifecycleNote,
        customerLifecycle: lifecycleTruth.customerLifecycle,
        openedAt: windowRow.openedAt,
        expiresAt: windowRow.expiresAt,
        closedAt: windowRow.closedAt,
        booking: windowRow.booking,
        vendor: windowRow.vendor,
      };

      if (!includeDetails) {
        return baseRow;
      }

      return {
        ...baseRow,
        mediaSession: windowRow.mediaSession,
        review:
          windowRow.review ||
          (Array.isArray(windowRow.booking?.reviews) && windowRow.booking.reviews.length > 0
            ? {
                id: windowRow.booking.reviews[0].id,
                createdAt: windowRow.booking.reviews[0].createdAt,
                rating: null,
                comment: null,
                submittedVia: 'historical',
              }
            : null),
        sentiments: windowRow.sentiments || [],
        promptEvents: windowRow.promptEvents || [],
        consentRecords: consentByBooking.get(String(windowRow.bookingId)) || [],
      };
    });

    return NextResponse.json({
      success: true,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: typeof total === 'number' ? Math.ceil(total / limit) : null,
      },
    });
  } catch (error: any) {
    console.error('[admin/review-audit] GET error', error);
    if (error.message === 'Unauthorized' || String(error.message).includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch review audit data' }, { status: 500 });
  }
}
