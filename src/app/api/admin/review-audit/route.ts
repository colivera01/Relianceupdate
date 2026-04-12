import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const bookingId = String(searchParams.get('bookingId') || '').trim();
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const customer = String(searchParams.get('customer') || '').trim();
    const reviewWindowStatus = String(searchParams.get('reviewWindowStatus') || '').trim();
    const sentiment = String(searchParams.get('sentiment') || '').trim();
    const consentStatus = String(searchParams.get('consentStatus') || '').trim();
    const dateFrom = String(searchParams.get('dateFrom') || '').trim();
    const dateTo = String(searchParams.get('dateTo') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
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
      ...(customer
        ? {
            booking: {
              OR: [{ userId: { contains: customer } }, { user: { email: { contains: customer } } }, { user: { phone: { contains: customer } } }],
            },
          }
        : {}),
      ...(sentiment ? { sentiments: { some: { sentiment } } } : {}),
      ...(consentStatus ? { booking: { consentRecords: { some: { status: consentStatus } } } } : {}),
    };

    const [total, reviewWindows] = await Promise.all([
      (prisma as any).reviewWindow.count({ where }),
      (prisma as any).reviewWindow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          booking: { select: { id: true, userId: true, user: { select: { email: true, phone: true, name: true } } } },
          vendor: { select: { id: true, name: true, businessName: true } },
          mediaSession: { select: { id: true, status: true, title: true } },
          review: { select: { id: true, rating: true, comment: true, submittedVia: true, createdAt: true } },
          sentiments: { orderBy: { createdAt: 'asc' } },
          promptEvents: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);

    const bookingIds = Array.from(new Set(reviewWindows.map((w: any) => String(w.bookingId))));
    const consentRecords = await (prisma as any).consentRecord.findMany({
      where: { bookingId: { in: bookingIds } },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    const consentByBooking = new Map<string, any[]>();
    for (const c of consentRecords) {
      const key = String(c.bookingId);
      if (!consentByBooking.has(key)) consentByBooking.set(key, []);
      consentByBooking.get(key)!.push(c);
    }

    const rows = reviewWindows.map((w: any) => ({
      reviewWindowId: w.id,
      status: w.status,
      openedAt: w.openedAt,
      expiresAt: w.expiresAt,
      closedAt: w.closedAt,
      booking: w.booking,
      vendor: w.vendor,
      mediaSession: w.mediaSession,
      review: w.review || null,
      sentiments: w.sentiments || [],
      promptEvents: w.promptEvents || [],
      consentRecords: consentByBooking.get(String(w.bookingId)) || [],
    }));

    return NextResponse.json({
      success: true,
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[admin/review-audit] GET error', error);
    if (error.message === 'Unauthorized' || String(error.message).includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch review audit data' }, { status: 500 });
  }
}
