import { NextResponse } from 'next/server';
import { customerLoadError } from '@/lib/customer-load-error';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from '@/lib/account-status';
import { isTransientDbConnectivityError } from '@/lib/transient-db-errors';
import { loadCustomerServiceRecords } from '@/lib/customer-service-records-server';
import { customerCommentModerationState } from '@/lib/review-rating-validity';

function positiveInt(value: string | null, fallback: number, maximum = 50): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function matchesSearch(item: { bookingId?: string | null; serviceName: string; vendorName: string }, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [item.bookingId, item.serviceName, item.vendorName]
    .some((value) => String(value || '').toLowerCase().includes(query));
}

function pageRows<T>(rows: T[], page: number, limit: number) {
  const total = rows.length;
  const totalPages = total ? Math.ceil(total / limit) : 0;
  const currentPage = totalPages ? Math.min(page, totalPages) : 1;
  return {
    rows: rows.slice((currentPage - 1) * limit, currentPage * limit),
    pagination: { page: currentPage, limit, total, totalPages },
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await ensureUserAccountCanAct(userId);

    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const search = String(searchParams.get('search') || '').trim();
    const limit = positiveInt(searchParams.get('limit'), 10);
    const readyPage = positiveInt(searchParams.get('readyPage'), 1, 100000);
    const submittedPage = positiveInt(searchParams.get('submittedPage'), 1, 100000);

    const [serviceRecords, submittedReviews] = await Promise.all([
      loadCustomerServiceRecords({
        db: prisma,
        customerUserId: String(userId),
        includeAll: true,
        limit: 50,
      }),
      prisma.review.findMany({
        where: { userId: String(userId) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          bookingId: true,
          vendorId: true,
          rating: true,
          comment: true,
          date: true,
          createdAt: true,
          moderationStatus: true,
          visibilityStatus: true,
          contractVersion: true,
          ratingValidityStatus: true,
          vendor: { select: { name: true, businessName: true } },
          booking: { select: { service: { select: { name: true } } } },
          employeeCustomerRating: {
            select: { rating: true, employeeNameSnapshot: true, submittedAt: true },
          },
        },
      }),
    ]);

    const completedUnreviewed = serviceRecords.records.filter((record: any) =>
      record.customer_record?.lifecycle === 'COMPLETED' && record.customer_record?.review?.state !== 'REVIEWED'
    );
    const readyRows = completedUnreviewed
      .filter((record: any) => record.customer_record?.review?.state === 'LEAVE_REVIEW')
      .map((record: any) => ({
        bookingId: String(record.id),
        vendorId: String(record.vendor?.id || ''),
        vendorName: String(record.vendor?.name || 'Service provider'),
        serviceName: String(record.service?.name || record.title || 'Service'),
        serviceDate: record.booking_date || null,
        archived: Boolean(record.customer_record?.archived),
      }))
      .filter((row) => matchesSearch(row, search));
    const awaitingRows = completedUnreviewed
      .filter((record: any) => record.customer_record?.review?.state !== 'LEAVE_REVIEW')
      .map((record: any) => ({
        bookingId: String(record.id),
        vendorId: String(record.vendor?.id || ''),
        vendorName: String(record.vendor?.name || 'Service provider'),
        serviceName: String(record.service?.name || record.title || 'Service'),
        serviceDate: record.booking_date || null,
        statusMessage: 'Review will be available when your Service Video is approved.',
        archived: Boolean(record.customer_record?.archived),
      }))
      .filter((row) => matchesSearch(row, search));
    const submittedRows = submittedReviews
      .map((review) => ({
        reviewId: String(review.id),
        bookingId: review.bookingId ? String(review.bookingId) : null,
        vendorId: String(review.vendorId),
        vendorName: String(review.vendor?.businessName || review.vendor?.name || 'Service provider'),
        serviceName: String(review.booking?.service?.name || 'Service'),
        rating: Number(review.rating),
        comment: String(review.comment || ''),
        submittedAt: (review.date || review.createdAt).toISOString(),
        employeeRating: review.employeeCustomerRating
          ? {
              rating: Number(review.employeeCustomerRating.rating),
              employeeName: review.employeeCustomerRating.employeeNameSnapshot,
              submittedAt: review.employeeCustomerRating.submittedAt.toISOString(),
            }
          : null,
        commentStatus: customerCommentModerationState(review),
        ratingStatus: review.ratingValidityStatus === 'invalid' ? 'INVALID' : 'COUNTED',
      }))
      .filter((row) => matchesSearch(row, search));

    if (summaryOnly) {
      return NextResponse.json({
        summary: {
          pendingTotal: readyRows.length,
          awaitingVideoTotal: awaitingRows.length,
          submittedTotal: submittedRows.length,
        },
      });
    }

    const ready = pageRows(readyRows, readyPage, limit);
    const submitted = pageRows(submittedRows, submittedPage, limit);
    return NextResponse.json({
      success: true,
      ready: ready.rows,
      awaiting: awaitingRows.slice(0, limit),
      submitted: submitted.rows,
      counts: { ready: readyRows.length, awaiting: awaitingRows.length, submitted: submittedRows.length },
      pagination: { ready: ready.pagination, submitted: submitted.pagination },
      search,
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return customerLoadError(error, 'reviews/me', 'Unable to load your reviews.', isTransientDbConnectivityError(error) ? 503 : 500);
  }
}
