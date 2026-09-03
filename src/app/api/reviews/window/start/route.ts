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
import { loadCustomerReviewEligibility } from '@/lib/customer-review-eligibility';

function publicEligibilityCode(code: string): string {
  if (code === 'SERVICE_NOT_COMPLETED') return 'BOOKING_NOT_COMPLETED';
  if (code === 'PRIVATE_PROOF_REQUIRED') return 'REVIEW_PRIVATE_PROOF_REQUIRED';
  return code;
}

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

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'bookingId is required' },
        { status: 400 }
      );
    }
    if (!requesterUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: customer context is required' }, { status: 401 });
    }
    await ensureUserAccountCanAct(requesterUserId);
    step = 'review_eligibility';
    logStep(step);
    const eligibility = await loadCustomerReviewEligibility({
      bookingId,
      customerUserId: requesterUserId,
      db: prisma,
    });
    if (!eligibility.eligible) {
      const status = eligibility.code === 'BOOKING_NOT_FOUND'
        ? 404
        : eligibility.code === 'WRONG_CUSTOMER'
          ? 403
          : eligibility.code === 'PRIVATE_PROOF_REQUIRED'
            ? 403
          : 409;
      return NextResponse.json(
        {
          success: false,
          error: eligibility.message,
          code: publicEligibilityCode(eligibility.code),
        },
        { status }
      );
    }
    vendorId = String(eligibility.vendorId || '');
    mediaSessionId = String(eligibility.mediaSessionId || '');
    if (!vendorId || !mediaSessionId) {
      return NextResponse.json(
        { success: false, error: 'Review evidence is incomplete', code: 'REVIEW_PRIVATE_PROOF_REQUIRED' },
        { status: 409 }
      );
    }
    if (body?.vendorId && String(body.vendorId).trim() !== vendorId) {
      return NextResponse.json(
        { success: false, error: 'Review Vendor does not match this Service Record', code: 'REVIEW_VENDOR_MISMATCH' },
        { status: 404 }
      );
    }
    if (body?.mediaSessionId && String(body.mediaSessionId).trim() !== mediaSessionId) {
      return NextResponse.json(
        { success: false, error: 'Review evidence does not match the approved Service Video', code: 'REVIEW_PROOF_BINDING_MISMATCH' },
        { status: 409 }
      );
    }
    await ensureVendorAccountCanOperate(vendorId);

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
