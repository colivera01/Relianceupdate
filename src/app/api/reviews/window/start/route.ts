import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getOrCreateActiveReviewWindow } from '@/lib/review-capture';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  ensureVendorAccountCanOperate,
} from '@/lib/account-status';
import { isCompletedStatus, normalizeBookingStatusKey } from '@/lib/my-bookings';
import { loadAuthorizedPrivateProof } from '@/lib/service-video-evidence';

export async function POST(request: NextRequest) {
  let bookingId = '';
  let vendorId = '';
  let mediaSessionId = '';
  let step = 'parse_request';
  const logStep = (name: string, metadata?: Record<string, unknown>) => {
    console.info('[reviews/window/start] step:', {
      step: name,
      bookingId,
      vendorId,
      mediaSessionId,
      ...(metadata || {}),
    });
  };
  try {
    step = 'parse_request';
    const body = await request.json();
    const requesterUserId = await getUserIdFromRequest(request);
    bookingId = String(body?.bookingId || '').trim();
    vendorId = String(body?.vendorId || '').trim();
    mediaSessionId = String(body?.mediaSessionId || '').trim();

    if (!bookingId || !vendorId || !mediaSessionId) {
      return NextResponse.json(
        { success: false, error: 'bookingId, vendorId, and mediaSessionId are required' },
        { status: 400 }
      );
    }
    if (!requesterUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: customer context is required' }, { status: 401 });
    }
    await ensureUserAccountCanAct(requesterUserId);
    await ensureVendorAccountCanOperate(vendorId);

    step = 'booking_lookup';
    logStep(step);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, vendorId: true, userId: true, status: true },
    });

    step = 'booking_vendor_check';
    logStep(step, {
      bookingFound: Boolean(booking),
      bookingVendorId: booking?.vendorId ?? null,
      bookingUserId: booking?.userId ?? null,
      requesterUserId,
    });
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }
    if (String(booking.userId || '') !== String(requesterUserId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: booking does not belong to this user' }, { status: 403 });
    }
    if (!isCompletedStatus(normalizeBookingStatusKey(booking.status))) {
      return NextResponse.json(
        {
          success: false,
          error: 'An optional review is available only after the booking is completed',
          code: 'BOOKING_NOT_COMPLETED',
        },
        { status: 409 }
      );
    }

    step = 'existing_review_check';
    logStep(step);
    const existingReview = await (prisma as any).review.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    if (existingReview?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'A review already exists for this booking',
          code: 'REVIEW_ALREADY_EXISTS',
        },
        { status: 409 }
      );
    }

    step = 'private_proof_validate';
    logStep(step);
    const privateProof = await loadAuthorizedPrivateProof({
      bookingId,
      customerUserId: requesterUserId,
    });
    if (!privateProof) {
      return NextResponse.json(
        {
          success: false,
          error: 'An active approved Private Proof is required before reviewing',
          code: 'REVIEW_PRIVATE_PROOF_REQUIRED',
        },
        { status: 403 }
      );
    }
    const finalStage = privateProof.stages.find(
      (stage: any) => String(stage.stage || '').toUpperCase() === 'COMPLETED'
    );
    if (!finalStage || String(finalStage.mediaSessionId || '') !== mediaSessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'The review must use the exact approved Final Result from this Private Proof',
          code: 'REVIEW_PROOF_BINDING_MISMATCH',
        },
        { status: 409 }
      );
    }

    step = 'review_window_get_or_create';
    logStep(step);
    const { window, created } = await getOrCreateActiveReviewWindow({ bookingId, vendorId, mediaSessionId });
    step = 'success_response';
    logStep(step, { created, reviewWindowId: window?.id ?? null });
    return NextResponse.json({
      success: true,
      reviewWindow: window,
      created,
      invitationDispatch: null,
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || null;
    const errorMeta = error?.meta || null;
    const details = {
      step,
      bookingId,
      vendorId,
      mediaSessionId,
      error: errorMessage,
      code: errorCode,
      meta: errorMeta,
    };
    console.error('[reviews/window/start] POST error:', {
      ...details,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare optional review',
        step,
        code: errorCode,
        meta: errorMeta,
        details,
      },
      { status: 500 }
    );
  }
}
