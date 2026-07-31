import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  ensureVendorAccountCanOperate,
} from '@/lib/account-status';
import { assertReviewWindowActive, isValidSubmittedVia } from '@/lib/review-capture';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { createAdminNotificationWithEmail } from '@/lib/admin-notifications';
import { parseAssignmentMetadata } from '@/lib/job-assignment';
import { requireVerifiedEmailForAction } from '@/lib/email-verification-enforcement';
import {
  normalizeReviewAttributionTarget,
  shouldAttributeReviewToAssignedTeam,
} from '@/lib/review-attribution-intent';
import { getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { isCompletedStatus, normalizeBookingStatusKey } from '@/lib/my-bookings';

export async function POST(request: NextRequest) {
  let step = 'parse_request';
  let debug: Record<string, unknown> = {};
  try {
    step = 'resolve_user';
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    await ensureUserAccountCanAct(userId);
    const verificationGate = await requireVerifiedEmailForAction({
      userId,
      action: 'submit_review',
    });
    if (verificationGate) {
      return verificationGate;
    }

    step = 'parse_body';
    const body = await request.json();
    const reviewWindowId = String(body?.reviewWindowId || '').trim();
    const bookingId = String(body?.bookingId || '').trim();
    const vendorId = String(body?.vendorId || '').trim();
    const mediaSessionId = body?.mediaSessionId != null ? String(body.mediaSessionId || '').trim() : '';
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim();
    const submittedVia = String(body?.submittedVia || '').trim();
    const reviewAttributionTarget = normalizeReviewAttributionTarget(body?.reviewAttributionTarget);
    const shouldAttributeToTeam = shouldAttributeReviewToAssignedTeam(reviewAttributionTarget);
    debug = {
      reviewWindowId,
      bookingId,
      vendorId,
      mediaSessionId,
      userId,
      rating,
      submittedVia,
      reviewAttributionTarget,
    };

    if (!reviewWindowId || !bookingId || !vendorId || !Number.isFinite(rating)) {
      return NextResponse.json(
        { success: false, error: 'reviewWindowId, bookingId, vendorId, and rating are required' },
        { status: 400 }
      );
    }
    await ensureVendorAccountCanOperate(vendorId);
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating must be between 1 and 5' }, { status: 400 });
    }
    if (!isValidSubmittedVia(submittedVia)) {
      return NextResponse.json({ success: false, error: 'Invalid submittedVia' }, { status: 400 });
    }

    step = 'assert_review_window_active';
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

    step = 'booking_lookup';
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, vendorId: true, status: true, customerMetadata: true },
    });
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }
    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Only the booking customer can submit review' }, { status: 403 });
    }
    if (!isCompletedStatus(normalizeBookingStatusKey(booking.status))) {
      return NextResponse.json(
        {
          success: false,
          error: 'A review is available only after the booking is completed',
          code: 'BOOKING_NOT_COMPLETED',
        },
        { status: 409 }
      );
    }

    step = 'customer_visible_final_proof_check';
    const customerVisibleFinalProof = await (prisma as any).mediaAsset.findFirst({
      where: {
        mediaSessionId: windowMediaSessionId,
        deletedAt: null,
        moderationStatus: 'approved',
        archiveStatus: 'active',
        visibilityStatus: { in: getVisibilityStatusesForAudience('customer') },
        mediaSession: {
          bookingId,
          vendorId,
          sessionType: 'JOB_SERVICE_VIDEO',
          vendorJobVideoStage: 'COMPLETED',
        },
      },
      select: { id: true },
    });
    if (!customerVisibleFinalProof) {
      return NextResponse.json(
        {
          success: false,
          error: 'An approved customer-visible final service video is required before reviewing',
          code: 'REVIEW_PROOF_NOT_CUSTOMER_VISIBLE',
        },
        { status: 409 }
      );
    }

    step = 'existing_review_lookup';
    const existingReview = await (prisma as any).review.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    if (existingReview) {
      return NextResponse.json(
        {
          success: false,
          error: 'A review already exists for this booking',
          code: 'REVIEW_ALREADY_EXISTS',
        },
        { status: 409 }
      );
    }

    step = 'resolve_assignment_attribution';
    const assignmentMetadata = parseAssignmentMetadata(booking.customerMetadata);
    const assignedMembershipIds = assignmentMetadata.assignedMembershipIds;
    const assignedEmployees = assignmentMetadata.assignedEmployees;
    const resolvedAssignedMembershipId =
      String(assignmentMetadata.primaryMembershipId || '').trim() ||
      (assignedMembershipIds.length > 0 ? String(assignedMembershipIds[0] || '').trim() : '');
    const assignedMembershipId = shouldAttributeToTeam ? resolvedAssignedMembershipId : '';
    let assignedEmployeeName =
      shouldAttributeToTeam
        ? String(assignmentMetadata.primaryEmployeeName || '').trim() ||
          (assignedEmployees.length > 0 ? String(assignedEmployees[0] || '').trim() : '')
        : '';
    let assignedUserId: string | null = null;
    if (assignedMembershipId) {
      const membership = await (prisma as any).vendorMembership.findFirst({
        where: { id: assignedMembershipId, vendorId },
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      });
      assignedUserId = membership?.userId ? String(membership.userId) : null;
      if (!assignedEmployeeName) {
        const fallbackName = String(membership?.user?.name || '').trim();
        const fallbackEmail = String(membership?.user?.email || '').trim();
        assignedEmployeeName = fallbackName || fallbackEmail;
      }
    }

    step = 'create_review_transaction';
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
          assignedMembershipId: assignedMembershipId || null,
          assignedEmployeeName: assignedEmployeeName || null,
          assignedUserId: assignedUserId || null,
          attributionVersion: 2,
          moderationStatus: 'pending_review',
          visibilityStatus: 'private',
          date: new Date(),
        },
      });

      await (tx as any).reviewWindow.update({
        where: { id: reviewWindowId },
        data: { status: 'submitted', reviewId: review.id, closedAt: new Date() },
      });

      await (tx as any).reviewWindow.updateMany({
        where: {
          bookingId,
          status: 'active',
          id: { not: reviewWindowId },
        },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
      });

      await (tx as any).reviewPromptEvent.create({
        data: {
          reviewWindowId,
          eventType: 'quick_review_submitted',
          metadata: JSON.stringify({
            rating,
            submittedVia,
            reviewAttributionTarget,
            employeeAttributionApplied: Boolean(assignedMembershipId),
          }),
        },
      });
      return review;
    });

    step = 'admin_audit_log';
    await createAdminAuditLog({
      actionType: 'review_capture_submitted',
      entityType: 'review',
      entityId: created.id,
      actorUserId: String(userId),
      metadata: {
        bookingId,
        vendorId,
        reviewWindowId,
        submittedVia,
        reviewAttributionTarget,
        employeeAttributionApplied: Boolean(assignedMembershipId),
      },
    });

    try {
      await createAdminNotificationWithEmail({
        vendorId,
        type: 'REVIEW_MODERATION_REQUIRED',
        title: 'Customer review waiting for moderation',
        message: `A customer submitted a ${rating}-star review that needs admin review before public visibility.`,
        metadata: {
          reviewId: created.id,
          bookingId,
          vendorId,
          reviewWindowId,
          rating,
          submittedVia,
          reviewAttributionTarget,
          employeeAttributionApplied: Boolean(assignedMembershipId),
        },
        surfaceHref: '/admin/reviews',
        baseUrl: request.nextUrl.origin,
        actorUserId: String(userId),
      });
    } catch (notificationError) {
      console.error('[reviews/create] admin moderation notification failed:', notificationError);
    }

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
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'A review already exists for this booking',
          code: 'REVIEW_ALREADY_EXISTS',
        },
        { status: 409 }
      );
    }
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || null;
    const errorMeta = error?.meta || null;
    console.error('[reviews/create] POST error:', {
      step,
      ...debug,
      error: errorMessage,
      code: errorCode,
      meta: errorMeta,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create review',
        code: errorCode,
        step,
        message: errorMessage,
        meta: errorMeta,
        details: {
          ...debug,
          step,
          error: errorMessage,
          code: errorCode,
          meta: errorMeta,
        },
      },
      { status: 500 }
    );
  }
}
