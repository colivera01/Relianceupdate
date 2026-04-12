import { NextRequest, NextResponse } from 'next/server';
import { checkVendorSlotAvailability } from '@/lib/availability-slots';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const vendorId = body?.vendorId ? String(body.vendorId) : '';
    const serviceId = body?.serviceId ? String(body.serviceId) : null;
    const booking_date = body?.booking_date ? String(body.booking_date) : '';
    const booking_time = body?.booking_time ? String(body.booking_time) : '';

    if (!vendorId || !booking_date || !booking_time) {
      return NextResponse.json(
        {
          available: false,
          reason: 'vendorId, booking_date, and booking_time are required',
        },
        { status: 400 }
      );
    }

    const result = await checkVendorSlotAvailability({
      vendorId,
      serviceId,
      booking_date,
      booking_time,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking slot availability:', error);
    return NextResponse.json(
      { available: false, reason: 'Failed to validate slot availability' },
      { status: 500 }
    );
  }
}
