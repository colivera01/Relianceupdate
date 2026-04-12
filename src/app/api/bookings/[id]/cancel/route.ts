import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { mapBookingToContract } from '@/lib/booking-shape';

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

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true },
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

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELED' },
    });
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
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
} 