import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from '@/lib/account-status';
import { mapBookingToContract } from '@/lib/booking-shape';
import { deriveCustomerBookingLifecycle } from '@/lib/customer-booking-lifecycle';
import {
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  isTransientDbConnectivityError,
} from '@/lib/transient-db-errors';
import { assertCoreAdminAuditMutationAllowed, CoreAdminAuditError } from '@/lib/service-video-admin-audit';
import { parseAssignmentMetadata } from '@/lib/job-assignment';
import { loadCustomerServiceRecords } from '@/lib/customer-service-records-server';

// TODO: Import your database models
// import { BookingModel } from '@/lib/models/Booking';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
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

    const booking = await prisma.booking.findUnique({
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
        vendor: {
          select: {
            id: true,
            name: true,
            businessName: true,
            phone: true,
            email: true,
            city: true,
            state: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
          },
        },
        mediaSessions: {
          where: { sessionType: 'JOB_SERVICE_VIDEO' },
          select: {
            vendorJobVideoStage: true,
            mediaAssets: {
              select: {
                mimeType: true,
                moderationStatus: true,
                visibilityStatus: true,
                archiveStatus: true,
              },
            },
          },
        },
        reviewWindows: {
          select: { status: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: booking does not belong to this user' },
        { status: 403 }
      );
    }

    const customerReview = await prisma.review.findFirst({
      where: {
        bookingId,
        userId: String(userId),
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        date: true,
        createdAt: true,
        employeeCustomerRating: {
          select: {
            rating: true,
            employeeMembershipId: true,
            employeeUserId: true,
            employeeNameSnapshot: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    let assignedServiceProfessional: {
      membershipId: string;
      userId: string;
      name: string;
    } | null = null;
    if (assignment.assignedMembershipIds.length === 1) {
      const membershipId = assignment.assignedMembershipIds[0];
      const membership = await prisma.vendorMembership.findFirst({
        where: { id: membershipId, vendorId: booking.vendorId },
        select: {
          id: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      });
      if (membership?.userId) {
        assignedServiceProfessional = {
          membershipId: membership.id,
          userId: membership.userId,
          name:
            String(assignment.primaryEmployeeName || membership.user?.name || membership.user?.email || '').trim() ||
            'Assigned service professional',
        };
      }
    }

    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: booking.status,
      mediaSessions: (booking as any).mediaSessions || [],
      hasSubmittedReview: Boolean(customerReview),
      reviewWindows: (booking as any).reviewWindows || [],
    });
    const customerRecordResult = await loadCustomerServiceRecords({
      db: prisma,
      customerUserId: userId,
      bookingId,
      includeAll: true,
      limit: 1,
    });
    const customerRecord = customerRecordResult.records[0]?.customer_record || null;

    return NextResponse.json({
      booking: mapBookingToContract(booking as any),
      customerReview: customerReview
        ? {
            id: String(customerReview.id),
            rating: Number(customerReview.rating),
            comment: String(customerReview.comment || ''),
            employeeRating: customerReview.employeeCustomerRating
              ? {
                  rating: Number(customerReview.employeeCustomerRating.rating),
                  employeeMembershipId: customerReview.employeeCustomerRating.employeeMembershipId,
                  employeeUserId: customerReview.employeeCustomerRating.employeeUserId,
                  employeeName: customerReview.employeeCustomerRating.employeeNameSnapshot,
                  submittedAt: customerReview.employeeCustomerRating.submittedAt.toISOString(),
                }
              : null,
            submittedAt:
              (customerReview.date || customerReview.createdAt)?.toISOString?.() ||
              customerReview.createdAt.toISOString(),
          }
        : null,
      assignedServiceProfessional,
      customerRecord,
      customerLifecycle: {
        ...lifecycle,
        reviewSubmittedAt:
          (customerReview?.date || customerReview?.createdAt)?.toISOString?.() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        { error: PUBLIC_DB_UNAVAILABLE_MESSAGE, code: PUBLIC_DB_UNAVAILABLE_CODE },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const { status, booking_date, booking_time, title, client_name } = body || {};

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

    if (status !== undefined) {
      return NextResponse.json(
        {
          error: 'Service Record status cannot be changed through the generic update route.',
          code: 'BOOKING_STATUS_MUTATION_NOT_ALLOWED',
        },
        { status: 422 }
      );
    }

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: booking does not belong to this user' },
        { status: 403 }
      );
    }
    await assertCoreAdminAuditMutationAllowed(prisma as any, { bookingId });

    let scheduledForUpdate: Date | undefined;
    if (booking_date || booking_time) {
      const date = booking_date || new Date().toISOString().split('T')[0];
      const time = booking_time || '00:00:00';
      const combined = new Date(`${date}T${time}`);
      if (!Number.isNaN(combined.getTime())) {
        scheduledForUpdate = combined;
      }
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...(title !== undefined ? { title: title ? String(title) : null } : {}),
        ...(client_name !== undefined ? { clientName: client_name ? String(client_name) : null } : {}),
        ...(scheduledForUpdate ? { scheduledFor: scheduledForUpdate, date: scheduledForUpdate } : {}),
      },
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
        vendor: {
          select: { id: true, name: true, businessName: true, phone: true, email: true, city: true, state: true },
        },
        service: {
          select: { id: true, name: true, description: true, price: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      booking: mapBookingToContract(updated as any),
      message: 'Booking updated successfully',
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (error instanceof CoreAdminAuditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  void request;
  return NextResponse.json(
    {
      error: 'Use the dedicated cancellation action and provide a cancellation reason.',
      code: 'BOOKING_CANCELLATION_ACTION_REQUIRED',
    },
    { status: 405, headers: { Allow: 'GET, PUT' } }
  );
}
