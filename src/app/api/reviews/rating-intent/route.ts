import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim() || null;
    const rating = Number(body?.rating);
    const timestamp = String(body?.timestamp || '').trim() || new Date().toISOString();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating must be an integer between 1 and 5' }, { status: 400 });
    }

    // Lightweight attribution log for reminder-link conversion analysis.
    console.info('[reviews/rating-intent] rating param received', {
      bookingId,
      rating,
      timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[reviews/rating-intent] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log rating intent' }, { status: 500 });
  }
}
