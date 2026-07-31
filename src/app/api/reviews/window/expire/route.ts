import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';

/**
 * Compatibility endpoint for older clients. Review opportunities no longer
 * expire, so this route performs ownership checks and makes no state change.
 */
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
      return NextResponse.json({ success: false, error: 'Review opportunity not found' }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: String(row.bookingId) },
      select: { id: true, userId: true },
    });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found for this review opportunity' },
        { status: 404 }
      );
    }
    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json(
        { success: false, error: 'Only the booking customer can manage this review opportunity' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      reviewWindow: row,
      reviewOpportunityStillAvailable: !row.reviewId,
      reviewCreated: false,
      message: 'Optional reviews do not expire. No review was created.',
    });
  } catch (error) {
    console.error('[reviews/window/expire] POST compatibility error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read review opportunity' },
      { status: 500 }
    );
  }
}
