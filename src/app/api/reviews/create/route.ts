import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
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
} from '@/lib/review-attribution-intent';
import { loadCustomerReviewEligibility } from '@/lib/customer-review-eligibility';
import { REVIEW_CONTRACT_VERSION, VERIFIED_RATING_STATUS } from '@/lib/review-rating-validity';

function reviewSubmissionHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function publicEligibilityCode(code: string): string {
  if (code === 'SERVICE_NOT_COMPLETED') return 'BOOKING_NOT_COMPLETED';
  if (code === 'PRIVATE_PROOF_REQUIRED') return 'REVIEW_PRIVATE_PROOF_REQUIRED';
  return code;
}

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
    const employeeRatingProvided = body?.employeeRating !== undefined && body?.employeeRating !== null && body?.employeeRating !== '';
    const employeeRating = employeeRatingProvided ? Number(body.employeeRating) : null;
    const reviewAttributionTarget = normalizeReviewAttributionTarget(body?.reviewAttributionTarget);
    const submissionRequestId = String(body?.requestId || '').trim() || null;
    const submissionRequestHash = reviewSubmissionHash({
      bookingId,
      vendorId,
      rating,
      comment: comment || null,
      employeeRating,
      submittedVia,
      reviewAttributionTarget,
    });
    debug = {
      reviewWindowId,
      bookingId,
      vendorId,
      mediaSessionId,
      userId,
      rating,
      submittedVia,
      reviewAttributionTarget,
      employeeRating,
      submissionRequestId,
      submissionRequestHash,
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
    if (
      employeeRatingProvided &&
      (!Number.isInteger(employeeRating) || Number(employeeRating) < 1 || Number(employeeRating) > 5)
    ) {
      return NextResponse.json(
        { success: false, error: 'employeeRating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }
    if (!isValidSubmittedVia(submittedVia)) {
      return NextResponse.json({ success: false, error: 'Invalid submittedVia' }, { status: 400 });
    }
    if (comment.length > 2000) {
      return NextResponse.json({ success: false, error: 'comment must be 2000 characters or fewer' }, { status: 400 });
    }
    if (submissionRequestId && submissionRequestId.length > 200) {
      return NextResponse.json({ success: false, error: 'requestId must be 200 characters or fewer' }, { status: 400 });
    }
    if (submissionRequestId) {
      const requestReplay = await (prisma as any).review.findFirst({
        where: { userId: String(userId), submissionRequestId },
        select: { id: true, bookingId: true, submissionRequestId: true, submissionRequestHash: true },
      });
      if (requestReplay) {
        if (requestReplay.submissionRequestHash === submissionRequestHash) {
          return NextResponse.json({ success: true, idempotent: true, review: requestReplay });
        }
        return NextResponse.json(
          { success: false, error: 'Review request conflicts with an earlier submission', code: 'REVIEW_IDEMPOTENCY_CONFLICT' },
          { status: 409 }
        );
      }
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
    step = 'canonical_review_eligibility';
    const eligibility = await loadCustomerReviewEligibility({
      bookingId,
      customerUserId: String(userId),
      db: prisma,
    });
    if (!eligibility.eligible && eligibility.code !== 'REVIEW_ALREADY_EXISTS') {
      return NextResponse.json(
        {
          success: false,
          error: eligibility.message,
          code: publicEligibilityCode(eligibility.code),
        },
        { status: 409 }
      );
    }
    if (eligibility.eligible && String(eligibility.mediaSessionId || '') !== windowMediaSessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Review window is not bound to the current approved Service Video',
          code: 'REVIEW_PROOF_BINDING_MISMATCH',
        },
        { status: 409 }
      );
    }

    step = 'existing_review_lookup';
    const existingReview = await (prisma as any).review.findFirst({
      where: { bookingId, userId: String(userId) },
      select: { id: true, submissionRequestId: true, submissionRequestHash: true },
    });
    if (existingReview) {
      if (existingReview.submissionRequestHash === submissionRequestHash) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          review: existingReview,
          reviewWindowId,
        });
      }
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
    if (employeeRatingProvided && assignedMembershipIds.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee rating is available only when one service professional is assigned',
          code: 'EMPLOYEE_RATING_ASSIGNMENT_AMBIGUOUS',
        },
        { status: 409 }
      );
    }
    const assignedMembershipId = employeeRatingProvided
      ? String(assignedMembershipIds[0] || '').trim()
      : '';
    const assignedMembershipIndex = assignedMembershipIds.findIndex(
      (membershipId) => String(membershipId) === assignedMembershipId
    );
    let assignedEmployeeName =
      employeeRatingProvided
        ? String(assignedEmployees[assignedMembershipIndex] || '').trim() ||
          (String(assignmentMetadata.primaryMembershipId || '').trim() === assignedMembershipId
            ? String(assignmentMetadata.primaryEmployeeName || '').trim()
            : '')
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
    if (employeeRatingProvided && (!assignedMembershipId || !assignedUserId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'The assigned service professional could not be verified for this work record',
          code: 'EMPLOYEE_RATING_ASSIGNMENT_UNAVAILABLE',
        },
        { status: 409 }
      );
    }

    step = 'create_review_transaction';
    const created = await prisma.$transaction(async (tx) => {
      const transactionalEligibility = await loadCustomerReviewEligibility({
        bookingId,
        customerUserId: String(userId),
        db: tx,
      });
      if (!transactionalEligibility.eligible || transactionalEligibility.mediaSessionId !== windowMediaSessionId) {
        const eligibilityError = new Error(transactionalEligibility.message) as Error & { code?: string };
        eligibilityError.code = transactionalEligibility.code;
        throw eligibilityError;
      }
      const transactionalWindow = await (tx as any).reviewWindow.findFirst({
        where: { id: reviewWindowId, bookingId, vendorId, mediaSessionId: windowMediaSessionId, status: 'active' },
        select: { id: true },
      });
      if (!transactionalWindow) {
        const windowError = new Error('Review window is no longer active') as Error & { code?: string };
        windowError.code = 'REVIEW_WINDOW_NOT_ACTIVE';
        throw windowError;
      }
      if (employeeRatingProvided) {
        const currentBooking = await (tx as any).booking.findUnique({
          where: { id: bookingId },
          select: { customerMetadata: true },
        });
        const currentAssignment = parseAssignmentMetadata(currentBooking?.customerMetadata);
        if (
          currentAssignment.assignedMembershipIds.length !== 1 ||
          String(currentAssignment.assignedMembershipIds[0]) !== assignedMembershipId
        ) {
          const assignmentError = new Error('The assigned service professional changed before review submission') as Error & { code?: string };
          assignmentError.code = 'EMPLOYEE_RATING_ASSIGNMENT_STALE';
          throw assignmentError;
        }
      }
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
          attributionVersion: 3,
          moderationStatus: comment ? 'pending_review' : 'not_applicable',
          visibilityStatus: 'private',
          contractVersion: REVIEW_CONTRACT_VERSION,
          ratingValidityStatus: VERIFIED_RATING_STATUS,
          submissionRequestId,
          submissionRequestHash,
          date: new Date(),
        },
      });

      const employeeCustomerRating = employeeRatingProvided
        ? await (tx as any).employeeCustomerRatingEvidence.create({
            data: {
              reviewId: review.id,
              bookingId,
              vendorId,
              customerUserId: String(userId),
              employeeMembershipId: assignedMembershipId,
              employeeUserId: String(assignedUserId),
              employeeNameSnapshot: assignedEmployeeName,
              rating: Number(employeeRating),
              evidenceVersion: 1,
            },
          })
        : null;

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
            employeeRatingProvided,
            employeeRatingEvidenceId: employeeCustomerRating?.id || null,
          }),
        },
      });
      return { review, employeeCustomerRating };
    }, { isolationLevel: 'Serializable' });

    step = 'admin_audit_log';
    await createAdminAuditLog({
      actionType: 'review_capture_submitted',
      entityType: 'review',
      entityId: created.review.id,
      actorUserId: String(userId),
      metadata: {
        bookingId,
        vendorId,
        reviewWindowId,
        submittedVia,
        reviewAttributionTarget,
        employeeRatingProvided,
        employeeRatingEvidenceId: created.employeeCustomerRating?.id || null,
      },
    });

    if (comment) try {
      await createAdminNotificationWithEmail({
        vendorId,
        type: 'REVIEW_MODERATION_REQUIRED',
        title: 'Customer comment waiting for moderation',
        message: 'A verified Customer Review includes written content that needs a publication decision. The Vendor Rating is already counted.',
        metadata: {
          reviewId: created.review.id,
          bookingId,
          vendorId,
          reviewWindowId,
          rating,
          submittedVia,
          reviewAttributionTarget,
          employeeRatingProvided,
          employeeRatingEvidenceId: created.employeeCustomerRating?.id || null,
        },
        surfaceHref: '/admin/reviews',
        baseUrl: new URL(request.url).origin,
        actorUserId: String(userId),
      });
    } catch (notificationError) {
      console.error('[reviews/create] admin moderation notification failed:', notificationError);
    }

    return NextResponse.json({
      success: true,
      review: created.review,
      employeeCustomerRating: created.employeeCustomerRating,
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
      const requestReplay = debug.submissionRequestId && debug.userId
        ? await (prisma as any).review.findFirst({
            where: {
              userId: String(debug.userId),
              submissionRequestId: String(debug.submissionRequestId),
            },
            select: { id: true, submissionRequestHash: true },
          })
        : null;
      if (requestReplay) {
        if (requestReplay.submissionRequestHash === debug.submissionRequestHash) {
          return NextResponse.json({ success: true, idempotent: true, review: requestReplay });
        }
        return NextResponse.json(
          { success: false, error: 'Review request conflicts with an earlier submission', code: 'REVIEW_IDEMPOTENCY_CONFLICT' },
          { status: 409 }
        );
      }
      const existing = debug.bookingId && debug.userId
        ? await (prisma as any).review.findFirst({
            where: { bookingId: String(debug.bookingId), userId: String(debug.userId) },
            select: { id: true, submissionRequestId: true, submissionRequestHash: true },
          })
        : null;
      if (existing?.submissionRequestHash === debug.submissionRequestHash) {
        return NextResponse.json({ success: true, idempotent: true, review: existing });
      }
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
