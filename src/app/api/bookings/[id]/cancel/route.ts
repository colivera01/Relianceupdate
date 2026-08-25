import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from '@/lib/account-status';
import { mapBookingToContract } from '@/lib/booking-shape';
import {
  BOOKING_SERVICE_ISSUE_TYPES,
  TRUST_OUTCOME_TYPES,
  tryRecordBookingServiceIssue,
  tryRecordFinalizedOperationalOutcome,
} from '@/lib/trust-score-outcome-foundation';
import { tryRecalculateVendorTrustScore } from '@/lib/trust-score-calculator';
import { assertCoreAdminAuditMutationAllowed, CoreAdminAuditError } from '@/lib/service-video-admin-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const { reason, refund_requested } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Invalid booking ID' },
        { status: 400 }
      );
    }
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: customer context is required' },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(userId);

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, vendorId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: booking does not belong to this user' },
        { status: 403 }
      );
    }
    await assertCoreAdminAuditMutationAllowed(prisma as any, {
      bookingId,
      vendorId: existing.vendorId || undefined,
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELED' },
    });
    const canceledAt = new Date();
    if (existing.vendorId) {
      await tryRecordFinalizedOperationalOutcome(prisma as any, {
        vendorId: existing.vendorId,
        bookingId,
        outcomeType: TRUST_OUTCOME_TYPES.BOOKING_CANCELED,
        sourceEntityType: 'booking',
        sourceEntityId: bookingId,
        finalizedAt: canceledAt,
        finalizedByUserId: userId,
        metadata: {
          previousStatus: existing.status,
          cancellationReason: typeof reason === 'string' ? reason : null,
          refundRequested: Boolean(refund_requested),
        },
      });

      if (refund_requested === true) {
        await tryRecordBookingServiceIssue(prisma as any, {
          bookingId,
          vendorId: existing.vendorId,
          issueType: BOOKING_SERVICE_ISSUE_TYPES.REFUND_REQUEST,
          status: 'PENDING',
          sourceEntityType: 'booking_cancellation',
          sourceEntityId: bookingId,
          reportedByUserId: userId,
          metadata: {
            cancellationReason: typeof reason === 'string' ? reason : null,
            refundRequestedAt: canceledAt.toISOString(),
          },
        });
      }

      // Internal-only, non-blocking Trust Score recalculation.
      await tryRecalculateVendorTrustScore(
        prisma as any,
        existing.vendorId,
        'booking_canceled',
        'booking_cancel'
      );
    }
    const hydrated = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        serviceId: true,
        title: true,
        clientName: true,
        amount: true,
        status: true,
        scheduledFor: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        customerMetadata: true,
        service: { select: { id: true, name: true, description: true, price: true } },
        vendor: { select: { id: true, name: true, businessName: true, phone: true, email: true, city: true, state: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: hydrated ? mapBookingToContract(hydrated as any) : null,
      cancellation_reason: reason,
      refund_requested,
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (error instanceof CoreAdminAuditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
