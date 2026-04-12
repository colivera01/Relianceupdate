import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { notifyReviewWindowClosedWithoutSubmission } from '@/lib/review-notifications';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const reviewWindowId = String(body?.reviewWindowId || '').trim();
    if (!reviewWindowId) {
      return NextResponse.json({ success: false, error: 'reviewWindowId is required' }, { status: 400 });
    }

    const row = await (prisma as any).reviewWindow.findUnique({ where: { id: reviewWindowId } });
    if (!row) {
      return NextResponse.json({ success: false, error: 'Review window not found' }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: String(row.bookingId) },
      select: { id: true, userId: true },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found for this review window' }, { status: 404 });
    }
    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json(
        { success: false, error: 'Only the booking customer can expire this review window' },
        { status: 403 }
      );
    }

    if (row.status !== 'active') {
      return NextResponse.json({ success: true, reviewWindow: row, message: `Window already ${row.status}` });
    }

    const updated = await (prisma as any).reviewWindow.update({
      where: { id: reviewWindowId },
      data: { status: 'expired', closedAt: new Date() },
    });

    const reviewCount = await prisma.review.count({
      where: { bookingId: String(updated.bookingId) } as any,
    });

    await (prisma as any).reviewPromptEvent.create({
      data: {
        reviewWindowId,
        eventType: 'dismissed',
        metadata: JSON.stringify({ reason: 'window_expired_no_submission' }),
      },
    });
    const notify = await notifyReviewWindowClosedWithoutSubmission({
      reviewWindowId,
      bookingId: String(updated.bookingId),
      vendorId: String(updated.vendorId),
      mediaSessionId: String(updated.mediaSessionId),
    });

    return NextResponse.json({
      success: true,
      reviewWindow: updated,
      bookingReviewCount: reviewCount,
      expiryNotification: notify,
    });
  } catch (error) {
    console.error('[reviews/window/expire] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to expire review window' }, { status: 500 });
  }
}
