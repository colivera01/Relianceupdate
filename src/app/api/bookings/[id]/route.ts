import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { mapBookingToContract } from '@/lib/booking-shape';

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

    return NextResponse.json({
      booking: mapBookingToContract(booking as any),
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
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
        ...(status ? { status: String(status).toUpperCase() } : {}),
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

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
} 