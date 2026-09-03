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
import { recordLifecycleAudit } from '@/lib/lifecycle-audit';

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const { reason, refund_requested } = body;
    const cancellationReason = String(reason || '').trim();

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

    if (cancellationReason.length < 3) {
      return NextResponse.json(
        { error: 'Enter a brief reason for cancelling this service.', code: 'CANCELLATION_REASON_REQUIRED' },
        { status: 422 }
      );
    }

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
    const canceledAt = new Date();
    const cancellation = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true, vendorId: true, status: true, customerMetadata: true },
      });
      if (!current) throw new Error('BOOKING_STATE_CHANGED');
      if (String(current.userId) !== userId) throw new Error('BOOKING_OWNER_CHANGED');
      await assertCoreAdminAuditMutationAllowed(tx as any, {
        bookingId,
        vendorId: current.vendorId || undefined,
      });
      const normalizedStatus = String(current.status || '').trim().toUpperCase();
      if (normalizedStatus === 'CANCELED' || normalizedStatus === 'CANCELLED') {
        return { booking: current, previousStatus: normalizedStatus, idempotent: true };
      }
      if (!['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(normalizedStatus)) {
        throw new Error('CUSTOMER_CANCELLATION_STATE_NOT_ALLOWED');
      }
      const metadata = parseMetadata(current.customerMetadata);
      metadata.vendor_job_cancellation = {
        status: 'CANCELED',
        canceled_at: canceledAt.toISOString(),
        canceled_by_user_id: userId,
        canceled_by_membership_id: null,
        reason: cancellationReason,
        source: 'CUSTOMER_CANCELLATION',
      };
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED', customerMetadata: JSON.stringify(metadata) },
      });
      return { booking, previousStatus: normalizedStatus, idempotent: false };
    }, { isolationLevel: 'Serializable' });

    if (existing.vendorId && !cancellation.idempotent) {
      await tryRecordFinalizedOperationalOutcome(prisma as any, {
        vendorId: existing.vendorId,
        bookingId,
        outcomeType: TRUST_OUTCOME_TYPES.BOOKING_CANCELED,
        sourceEntityType: 'booking',
        sourceEntityId: bookingId,
        finalizedAt: canceledAt,
        finalizedByUserId: userId,
        metadata: {
          previousStatus: cancellation.previousStatus,
          cancellationReason,
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
            cancellationReason,
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
      await recordLifecycleAudit({
        actionType: 'customer_service_canceled',
        entityType: 'booking',
        entityId: bookingId,
        actorUserId: userId,
        previousValue: { status: cancellation.previousStatus },
        newValue: { status: 'CANCELED', reason: cancellationReason, canceledAt: canceledAt.toISOString() },
        metadata: { vendorId: existing.vendorId, customerOwnedAction: true },
      });
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
      cancellation_reason: cancellationReason,
      refund_requested,
      idempotent: cancellation.idempotent,
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (error instanceof CoreAdminAuditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'CUSTOMER_CANCELLATION_STATE_NOT_ALLOWED') {
      return NextResponse.json(
        { error: 'This Service Record can no longer be cancelled by the customer.', code: error.message },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === 'BOOKING_STATE_CHANGED') {
      return NextResponse.json({ error: 'Booking not found', code: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'BOOKING_OWNER_CHANGED') {
      return NextResponse.json({ error: 'This booking no longer belongs to your account.', code: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
