import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { mapBookingToContract } from '@/lib/booking-shape';
import { checkVendorSlotAvailability } from '@/lib/availability-slots';
import { findUserIdByEmailCaseInsensitive } from '@/lib/resolve-booking-owner-user-id';

/** Structured payload stored as JSON string in `Booking.customerMetadata` (snake_case keys). */
function buildCustomerMetadataForCreate(body: {
  user_notes?: unknown;
  client_email?: unknown;
  client_phone?: unknown;
  custom_fields?: unknown;
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const notes = typeof body.user_notes === 'string' ? body.user_notes.trim() : '';
  if (notes) out.user_notes = notes;
  const email = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  if (email) out.client_email = email;
  const phone = typeof body.client_phone === 'string' ? body.client_phone.trim() : '';
  if (phone) out.client_phone = phone;
  if (body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields)) {
    const cf = body.custom_fields as Record<string, unknown>;
    if (Object.keys(cf).length > 0) out.custom_fields = cf;
  }
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

// TODO: Import your database models
// import { BookingModel } from '@/lib/models/Booking';
// import { ServiceModel } from '@/lib/models/Service';
// import { VendorModel } from '@/lib/models/Vendor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const vendorId = searchParams.get('vendorId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10;
    const skip = (safePage - 1) * safeLimit;

    const authUserId = await getUserIdFromRequest(request);
    const userId = authUserId || (requestedUserId ? String(requestedUserId) : null);
    if (!userId && !vendorId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required' },
        { status: 401 }
      );
    }

    const where: any = {
      ...(userId ? { userId: String(userId) } : {}),
      ...(vendorId ? { vendorId: String(vendorId) } : {}),
      ...(status ? { status: String(status).toUpperCase() } : {}),
    };

    const [total, records] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        select: {
          id: true,
          serviceId: true,
          vendorId: true,
          userId: true,
          title: true,
          clientName: true,
          amount: true,
          status: true,
          scheduledFor: true,
          date: true,
          createdAt: true,
          updatedAt: true,
          customerMetadata: true,
          service: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              businessName: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    const bookings = records.map((booking) => mapBookingToContract(booking as any));

    return NextResponse.json({
      bookings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    const body = await request.json();
    const {
      service_id,
      vendor_id,
      booking_date,
      booking_time,
      user_notes,
      custom_fields,
      title,
      client_name,
      client_email,
      client_phone,
      amount,
      user_id,
      userId: bodyUserIdCamel,
    } = body as Record<string, unknown>;

    // Validate minimum required fields for vendor job creation flow
    if (!vendor_id) {
      return NextResponse.json(
        { error: 'vendor_id is required' },
        { status: 400 }
      );
    }

    const vendorId = String(vendor_id);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Resolve service for required Booking.serviceId FK.
    let serviceId: string | null = null;
    if (service_id) {
      const existingService = await prisma.service.findFirst({
        where: { id: String(service_id), vendorId },
        select: { id: true },
      });
      serviceId = existingService?.id || null;
    }
    if (!serviceId) {
      const firstVendorService = await prisma.service.findFirst({
        where: { vendorId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      serviceId = firstVendorService?.id || null;
    }
    if (!serviceId) {
      const createdService = await prisma.service.create({
        data: {
          vendorId,
          name: 'General Service Job',
          description: 'Auto-created default service for vendor jobs',
          price: 0,
        },
      });
      serviceId = createdService.id;
    }

    const clientEmailCombined =
      (typeof client_email === 'string' && client_email.trim()) ||
      (typeof body.clientEmail === 'string' && String(body.clientEmail).trim()) ||
      '';

    let isVendorStaffForThisVendor = false;
    if (authUserId) {
      const staffMembership = await prisma.vendorMembership.findFirst({
        where: { vendorId, userId: String(authUserId), status: 'ACTIVE' },
        select: { id: true },
      });
      isVendorStaffForThisVendor = Boolean(staffMembership);
    }

    let bookingUserId: string | null = null;

    if (isVendorStaffForThisVendor) {
      if (!clientEmailCombined) {
        return NextResponse.json(
          {
            error:
              'Client email is required for vendor-created jobs so the booking is linked to the customer\'s Reliance account (My Services).',
            code: 'CLIENT_EMAIL_REQUIRED',
          },
          { status: 400 }
        );
      }
      const customerId = await findUserIdByEmailCaseInsensitive(prisma, clientEmailCombined);
      if (!customerId) {
        return NextResponse.json(
          {
            error:
              'No Reliance customer account uses that email. The customer must sign up (or you must use the email on their profile) before this job can appear in their My Services.',
            code: 'CUSTOMER_EMAIL_NOT_FOUND',
          },
          { status: 422 }
        );
      }
      bookingUserId = customerId;
    } else {
      const fromBody =
        (user_id != null && String(user_id).trim() ? String(user_id).trim() : null) ||
        (bodyUserIdCamel != null && String(bodyUserIdCamel).trim()
          ? String(bodyUserIdCamel).trim()
          : null);
      bookingUserId = authUserId || fromBody;
    }

    if (!bookingUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required for booking creation' },
        { status: 401 }
      );
    }

    const combinedDateTime =
      booking_date && booking_time
        ? new Date(`${booking_date}T${booking_time}`)
        : new Date();
    const scheduledFor = Number.isNaN(combinedDateTime.getTime()) ? new Date() : combinedDateTime;

    if (booking_date && booking_time) {
      const slotCheck = await checkVendorSlotAvailability({
        vendorId,
        serviceId,
        booking_date: String(booking_date),
        booking_time: String(booking_time),
      });
      if (!slotCheck.available) {
        return NextResponse.json(
          {
            error: slotCheck.reason || 'Selected slot is unavailable',
            code: 'SLOT_UNAVAILABLE',
          },
          { status: 409 }
        );
      }
    }

    const customerMetadataPayload = buildCustomerMetadataForCreate({
      user_notes,
      client_email,
      client_phone,
      custom_fields,
    });
    const customerMetadata =
      customerMetadataPayload !== undefined ? JSON.stringify(customerMetadataPayload) : undefined;

    let resolvedAmount = 0;
    if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
      const n = Number(amount);
      if (Number.isFinite(n) && n >= 0) resolvedAmount = n;
    } else {
      const priceRow = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { price: true },
      });
      if (priceRow?.price != null) {
        const n = Number(priceRow.price);
        if (Number.isFinite(n) && n >= 0) resolvedAmount = n;
      }
    }

    const booking = await prisma.booking.create({
      data: {
        vendorId,
        serviceId,
        userId: bookingUserId,
        title: title ? String(title) : null,
        clientName: client_name ? String(client_name) : null,
        status: 'PENDING',
        scheduledFor,
        date: scheduledFor,
        amount: resolvedAmount,
        ...(customerMetadata != null ? { customerMetadata } : {}),
      },
    });

    const hydrated = await prisma.booking.findUnique({
      where: { id: booking.id },
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

    const contract = mapBookingToContract((hydrated || booking) as any);

    return NextResponse.json({
      success: true,
      booking: contract,
      message: 'Booking created successfully',
      /** @deprecated Prefer `booking.customer_metadata` — kept for older clients. */
      meta: {
        user_notes: (contract.customer_metadata as { user_notes?: string } | null)?.user_notes ?? null,
        custom_fields: (contract.customer_metadata as { custom_fields?: unknown } | null)?.custom_fields ?? null,
        client_email: (contract.customer_metadata as { client_email?: string } | null)?.client_email ?? null,
        client_phone: (contract.customer_metadata as { client_phone?: string } | null)?.client_phone ?? null,
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
} 