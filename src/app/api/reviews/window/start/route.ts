import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getOrCreateActiveReviewWindow } from '@/lib/review-capture';
import { scheduleReviewReminder } from '@/lib/review-notifications';

// TODO(server-hardening): Optionally require getUserIdFromRequest + booking.userId match (see REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md). Consent checks must remain.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();
    const vendorId = String(body?.vendorId || '').trim();
    const mediaSessionId = String(body?.mediaSessionId || '').trim();

    if (!bookingId || !vendorId || !mediaSessionId) {
      return NextResponse.json(
        { success: false, error: 'bookingId, vendorId, and mediaSessionId are required' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, vendorId: true },
    });
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }

    const mediaSession = await (prisma as any).mediaSession.findUnique({
      where: { id: mediaSessionId },
      select: { id: true, bookingId: true, vendorId: true },
    });
    if (!mediaSession || String(mediaSession.vendorId) !== vendorId || String(mediaSession.bookingId || '') !== bookingId) {
      return NextResponse.json({ success: false, error: 'Invalid mediaSession for booking/vendor' }, { status: 404 });
    }

    const acceptedConsent = await (prisma as any).consentRecord.findFirst({
      where: {
        bookingId,
        vendorId,
        mediaSessionId,
        consentType: 'video_access',
        status: 'accepted',
      },
      select: { id: true },
    });
    if (!acceptedConsent) {
      return NextResponse.json(
        { success: false, error: 'Video consent is required before review/video access' },
        { status: 403 }
      );
    }

    const { window, created } = await getOrCreateActiveReviewWindow({ bookingId, vendorId, mediaSessionId });
    let reminderDispatch: Awaited<ReturnType<typeof scheduleReviewReminder>> | null = null;
    if (created) {
      reminderDispatch = await scheduleReviewReminder({
        reviewWindowId: window.id,
        bookingId,
        vendorId,
        mediaSessionId,
      });
    }
    return NextResponse.json({
      success: true,
      reviewWindow: window,
      created,
      reminderDispatch,
    });
  } catch (error) {
    console.error('[reviews/window/start] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to start review window' }, { status: 500 });
  }
}
