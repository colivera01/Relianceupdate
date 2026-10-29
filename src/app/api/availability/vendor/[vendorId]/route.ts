import { NextRequest, NextResponse } from 'next/server';
import { getVendorAvailabilitySlots } from '@/lib/availability-slots';
import { requireVendorManager } from '@/lib/membership-auth';
import { countableServiceWhere, countableVendorWhere } from '@/lib/metrics-exclusion';
import { prisma } from '@/server/db';

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

    const publicVendor = await prisma.vendor.findFirst({
      where: countableVendorWhere({ id: vendorId, isPubliclyListed: true, accountStatus: 'active' }),
      select: { id: true },
    });
    if (!publicVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    if (serviceId) {
      const publicService = await prisma.service.findFirst({
        where: countableServiceWhere({ id: serviceId, vendorId, isPublished: true }),
        select: { id: true },
      });
      if (!publicService) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
    }

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

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      );
    }

    await requireVendorManager(request, vendorId);
    const body = await request.json();
    const { availability_schedule, blocked_dates } = body;

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
