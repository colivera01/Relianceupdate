import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const vendorId = parseInt(params.vendorId);
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const serviceId = searchParams.get('serviceId');

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      );
    }

    // TODO: Replace with actual database query
    // const availability = await AvailabilityModel.findMany({
    //   where: {
    //     vendor_id: vendorId,
    //     ...(serviceId && { service_id: parseInt(serviceId) }),
    //     ...(dateFrom && { date: { gte: dateFrom } }),
    //     ...(dateTo && { date: { lte: dateTo } }),
    //   },
    //   orderBy: { date: 'asc' },
    // });

    // Mock availability data
    const mockAvailability = {
      vendor_id: vendorId,
      service_id: serviceId ? parseInt(serviceId) : null,
      schedule: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true },
        wednesday: { start: '09:00', end: '17:00', available: true },
        thursday: { start: '09:00', end: '17:00', available: true },
        friday: { start: '09:00', end: '17:00', available: true },
        saturday: { start: '09:00', end: '15:00', available: true },
        sunday: { start: '10:00', end: '14:00', available: false },
      },
      dates: [
        {
          date: '2024-01-20',
          available: true,
          slots: [
            { time: '09:00', available: true },
            { time: '10:00', available: true },
            { time: '11:00', available: false },
            { time: '12:00', available: true },
            { time: '13:00', available: true },
            { time: '14:00', available: true },
            { time: '15:00', available: true },
            { time: '16:00', available: true },
          ],
        },
        {
          date: '2024-01-21',
          available: true,
          slots: [
            { time: '09:00', available: true },
            { time: '10:00', available: true },
            { time: '11:00', available: true },
            { time: '12:00', available: true },
            { time: '13:00', available: true },
            { time: '14:00', available: true },
            { time: '15:00', available: true },
            { time: '16:00', available: true },
          ],
        },
        {
          date: '2024-01-22',
          available: false,
          reason: 'Holiday',
          slots: [],
        },
        {
          date: '2024-01-23',
          available: true,
          slots: [
            { time: '09:00', available: true },
            { time: '10:00', available: true },
            { time: '11:00', available: true },
            { time: '12:00', available: true },
            { time: '13:00', available: true },
            { time: '14:00', available: true },
            { time: '15:00', available: true },
            { time: '16:00', available: true },
          ],
        },
      ],
      blocked_dates: [
        { date: '2024-01-22', reason: 'Holiday' },
        { date: '2024-01-29', reason: 'Personal day' },
      ],
      response_time: '30-60 minutes',
      available_now: true,
      available_today: true,
      available_this_week: true,
      next_available: '2024-01-20T09:00:00Z',
    };

    return NextResponse.json({ availability: mockAvailability });
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
  { params }: { params: { vendorId: string } }
) {
  try {
    const vendorId = parseInt(params.vendorId);
    const body = await request.json();
    const { availability_schedule, blocked_dates } = body;

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      );
    }

    // TODO: Validate vendor exists and user has permission
    // const vendor = await VendorModel.findById(vendorId);
    // if (!vendor) {
    //   return NextResponse.json(
    //     { error: 'Vendor not found' },
    //     { status: 404 }
    //   );
    // }

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
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    );
  }
} 