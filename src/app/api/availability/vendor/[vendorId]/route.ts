import { NextRequest, NextResponse } from 'next/server';
import { getVendorAvailabilitySlots } from '@/lib/availability-slots';
import { requireVendorManager } from '@/lib/membership-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId: vendorIdParam } = await params;
    const vendorId = String(vendorIdParam);
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const serviceId = searchParams.get('serviceId');

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      );
    }

    await requireVendorManager(request, vendorId);

    const payload = await getVendorAvailabilitySlots({
      vendorId,
      dateFrom,
      dateTo,
      serviceId,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId: vendorIdParam } = await params;
    const vendorId = String(vendorIdParam);
    const body = await request.json();
    const { availability_schedule, blocked_dates } = body;

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      );
    }

    // TODO: Update availability in database
    // await AvailabilityModel.update(vendorId, {
    //   availability_schedule,
    //   blocked_dates,
    //   updated_at: new Date(),
    // });

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      vendor_id: vendorId,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Manager access')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    );
  }
}
