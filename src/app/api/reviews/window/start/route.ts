import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getOrCreateActiveReviewWindow } from '@/lib/review-capture';
import { sendReviewInvitation } from '@/lib/review-notifications';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  ensureVendorAccountCanOperate,
} from '@/lib/account-status';
import { getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { isCompletedStatus, normalizeBookingStatusKey } from '@/lib/my-bookings';

// TODO(server-hardening): Optionally require getUserIdFromRequest + booking.userId match (see REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md). Consent checks must remain.

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

    step = 'media_session_lookup';
    logStep(step);
    const mediaSession = await (prisma as any).mediaSession.findUnique({
      where: { id: mediaSessionId },
      select: {
        id: true,
        bookingId: true,
        vendorId: true,
        sessionType: true,
        vendorJobVideoStage: true,
      },
    });

    step = 'media_session_validate';
    logStep(step, {
      mediaSessionFound: Boolean(mediaSession),
      mediaSessionBookingId: mediaSession?.bookingId ?? null,
      mediaSessionVendorId: mediaSession?.vendorId ?? null,
    });
    if (!mediaSession || String(mediaSession.vendorId) !== vendorId || String(mediaSession.bookingId || '') !== bookingId) {
      return NextResponse.json({ success: false, error: 'Invalid mediaSession for booking/vendor' }, { status: 404 });
    }
    if (
      String(mediaSession.sessionType || '').trim().toUpperCase() !== 'JOB_SERVICE_VIDEO' ||
      String(mediaSession.vendorJobVideoStage || '').trim().toUpperCase() !== 'COMPLETED'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'An optional review requires the final-result service video',
          code: 'REVIEW_REQUIRES_COMPLETED_STAGE_VIDEO',
        },
        { status: 409 }
      );
    }

    step = 'media_visibility_validate';
    logStep(step);
    const customerVisibleAsset = await (prisma as any).mediaAsset.findFirst({
      where: {
        mediaSessionId,
        deletedAt: null,
        moderationStatus: 'approved',
        archiveStatus: 'active',
        visibilityStatus: {
          in: getVisibilityStatusesForAudience('customer'),
        },
      },
      select: { id: true },
    });
    if (!customerVisibleAsset) {
      return NextResponse.json(
        { success: false, error: 'Selected media session is not customer-visible' },
        { status: 403 }
      );
    }

    step = 'accepted_consent_lookup';
    logStep(step);
    const acceptedConsent = await (prisma as any).consentRecord.findFirst({
      where: {
        bookingId,
        vendorId,
        consentType: 'video_access',
        status: 'accepted',
      },
      select: { id: true },
      orderBy: { acceptedAt: 'desc' },
    });
    step = 'accepted_consent_validate';
    logStep(step, { acceptedConsentId: acceptedConsent?.id ?? null });
    if (!acceptedConsent) {
      return NextResponse.json(
        { success: false, error: 'Video consent is required before review/video access' },
        { status: 403 }
      );
    }

    step = 'review_window_get_or_create';
    logStep(step);
    const { window, created } = await getOrCreateActiveReviewWindow({ bookingId, vendorId, mediaSessionId });
    let invitationDispatch: Awaited<ReturnType<typeof sendReviewInvitation>> | null = null;
    if (created) {
      step = 'review_invitation_send';
      logStep(step, { reviewWindowId: window.id });
      try {
        invitationDispatch = await sendReviewInvitation({
          reviewWindowId: window.id,
          bookingId,
          vendorId,
          mediaSessionId,
        });
      } catch (notificationError) {
        // Best-effort only; do not fail window start when notifications fail.
        const err = notificationError as any;
        console.error('[reviews/window/start] invitation send failed (non-blocking):', {
          reviewWindowId: window.id,
          error: err?.message || String(notificationError),
          code: err?.code,
          meta: err?.meta,
        });
        invitationDispatch = {
          queued: false,
          reason: 'invitation_failed_non_blocking',
          synchronousInvitationAttempt: false,
          context: { reviewWindowId: window.id, bookingId, vendorId, mediaSessionId },
          delivery: null,
          loadError: err?.message || String(notificationError),
        };
      }
    }
    step = 'success_response';
    logStep(step, { created, reviewWindowId: window?.id ?? null });
    return NextResponse.json({
      success: true,
      reviewWindow: window,
      created,
      invitationDispatch,
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
