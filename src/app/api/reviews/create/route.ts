import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { assertReviewWindowActive, isValidSubmittedVia } from '@/lib/review-capture';
import { createAdminAuditLog } from '@/lib/admin-audit';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const reviewWindowId = String(body?.reviewWindowId || '').trim();
    const bookingId = String(body?.bookingId || '').trim();
    const vendorId = String(body?.vendorId || '').trim();
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim();
    const submittedVia = String(body?.submittedVia || '').trim();

    if (!reviewWindowId || !bookingId || !vendorId || !Number.isFinite(rating)) {
      return NextResponse.json(
        { success: false, error: 'reviewWindowId, bookingId, vendorId, and rating are required' },
        { status: 400 }
      );
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating must be between 1 and 5' }, { status: 400 });
    }
    if (!isValidSubmittedVia(submittedVia)) {
      return NextResponse.json({ success: false, error: 'Invalid submittedVia' }, { status: 400 });
    }

    const state = await assertReviewWindowActive(reviewWindowId);
    if (!state.ok) {
      return NextResponse.json({ success: false, error: state.error }, { status: state.status });
    }

    const w = state.window;
    if (String(w.bookingId) !== String(bookingId) || String(w.vendorId) !== String(vendorId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Review window does not match the submitted booking or vendor',
          code: 'REVIEW_WINDOW_CONTEXT_MISMATCH',
        },
        { status: 409 }
      );
    }
    const windowMediaSessionId = w.mediaSessionId != null ? String(w.mediaSessionId).trim() : '';
    if (!windowMediaSessionId) {
      return NextResponse.json(
        { success: false, error: 'Review window has no valid media session' },
        { status: 400 }
      );
    }
    const bodyMediaSessionId =
      body?.mediaSessionId != null && String(body.mediaSessionId).trim()
        ? String(body.mediaSessionId).trim()
        : '';
    if (bodyMediaSessionId && bodyMediaSessionId !== windowMediaSessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Review window media session does not match submitted mediaSessionId',
          code: 'REVIEW_WINDOW_MEDIA_MISMATCH',
        },
        { status: 409 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, vendorId: true },
    });
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }
    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Only the booking customer can submit review' }, { status: 403 });
    }

    const existingReview = await (prisma as any).review.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    if (existingReview) {
      return NextResponse.json({ success: false, error: 'A review already exists for this booking' }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const review = await (tx as any).review.create({
        data: {
          userId: String(userId),
          vendorId,
          bookingId,
          mediaSessionId: windowMediaSessionId,
          rating,
          comment: comment || null,
          clientName: null,
          source: 'customer',
          submittedVia,
          moderationStatus: 'approved',
          visibilityStatus: 'private',
          date: new Date(),
        },
      });

      await (tx as any).reviewWindow.update({
        where: { id: reviewWindowId },
        data: { status: 'submitted', reviewId: review.id, closedAt: new Date() },
      });

      await (tx as any).reviewPromptEvent.create({
        data: {
          reviewWindowId,
          eventType: 'quick_review_submitted',
          metadata: JSON.stringify({ rating, submittedVia }),
        },
      });
      return review;
    });

    await createAdminAuditLog({
      actionType: 'review_capture_submitted',
      entityType: 'review',
      entityId: created.id,
      actorUserId: String(userId),
      metadata: { bookingId, vendorId, reviewWindowId, submittedVia },
    });

    return NextResponse.json({
      success: true,
      review: created,
      reviewWindowId,
      links: {
        bookingId,
        vendorId,
        mediaSessionId: windowMediaSessionId,
      },
    });
  } catch (error) {
    console.error('[reviews/create] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create review' }, { status: 500 });
  }
}
