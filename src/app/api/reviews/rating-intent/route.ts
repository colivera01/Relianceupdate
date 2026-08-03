import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import {
  authorizationErrorResponse,
  requireRequestActor,
} from '@/lib/request-actor';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRequestActor(request);
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();
    const rating = Number(body?.rating);
    const timestamp = String(body?.timestamp || '').trim() || new Date().toISOString();

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const ownedBooking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: actor.userId },
      select: { id: true },
    });
    if (!ownedBooking) {
      return NextResponse.json({ success: false, error: 'Work record not found' }, { status: 404 });
    }

    // Lightweight attribution log for reminder-link conversion analysis.
    console.info('[reviews/rating-intent] rating param received', {
      bookingId,
      rating,
      timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error('[reviews/rating-intent] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log rating intent' }, { status: 500 });
  }
}
