import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as bookingsListGET, POST as bookingsCreatePOST } from './route';
import { GET as bookingDetailGET, PUT as bookingPutPUT, DELETE as bookingDeleteDELETE } from './[id]/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { checkVendorSlotAvailability } from '@/lib/availability-slots';

const hoisted = vi.hoisted(() => {
  const bookingCount = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingCreate = vi.fn();
  const bookingUpdate = vi.fn();
  const vendorFindUnique = vi.fn();
  const serviceFindFirst = vi.fn();
  const serviceFindUnique = vi.fn();
  const serviceCreate = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const userFindFirst = vi.fn();
  const userFindUnique = vi.fn();
  const userCreate = vi.fn();
  const reviewFindFirst = vi.fn();
  const queryRaw = vi.fn();

  const prisma = {
    booking: {
      count: bookingCount,
      findMany: bookingFindMany,
      findUnique: bookingFindUnique,
      create: bookingCreate,
      update: bookingUpdate,
    },
    vendor: { findUnique: vendorFindUnique },
    service: { findFirst: serviceFindFirst, findUnique: serviceFindUnique, create: serviceCreate },
    vendorMembership: { findFirst: vendorMembershipFindFirst },
    user: { findFirst: userFindFirst, findUnique: userFindUnique, create: userCreate },
    review: { findFirst: reviewFindFirst },
    $queryRaw: queryRaw,
  };

  return {
    prisma,
    bookingCount,
    bookingFindMany,
    bookingFindUnique,
    bookingCreate,
    bookingUpdate,
    vendorFindUnique,
    serviceFindFirst,
    serviceFindUnique,
    serviceCreate,
    vendorMembershipFindFirst,
    userFindFirst,
    userFindUnique,
    userCreate,
    reviewFindFirst,
    queryRaw,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/availability-slots', () => ({
  checkVendorSlotAvailability: vi.fn(),
}));

vi.mock('@/lib/email-verification-enforcement', () => ({
  requireVerifiedEmailForAction: vi.fn().mockResolvedValue(null),
}));

function jsonRequest(url: string, body?: unknown, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET') {
  return new NextRequest(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

function baseHydratedBooking(overrides: Partial<Record<string, unknown>> = {}) {
  const scheduled = new Date('2024-07-10T15:00:00.000Z');
  const createdAt = new Date('2024-07-01T10:00:00.000Z');
  const updatedAt = new Date('2024-07-01T11:00:00.000Z');
  return {
    id: 'book-1',
    userId: 'customer-1',
    vendorId: 'ven-1',
    serviceId: 'svc-1',
    title: 'Clean',
    clientName: 'Pat',
    amount: 99,
    status: 'PENDING',
    scheduledFor: scheduled,
    date: scheduled,
    createdAt,
    updatedAt,
    customerMetadata: null,
    service: { id: 'svc-1', name: 'Deep clean', description: 'd', price: 99 },
    vendor: {
      id: 'ven-1',
      name: 'V',
      businessName: 'Vendor Co',
      phone: '1',
      email: 'v@v.com',
      city: 'Orlando',
      state: 'FL',
    },
    ...overrides,
  };
}

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingCount.mockReset();
    hoisted.bookingFindMany.mockReset();
  });

  it('returns 401 when neither user nor vendor context is available', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/bookings');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(String(j.error)).toContain('Unauthorized');
    expect(hoisted.bookingCount).not.toHaveBeenCalled();
  });

  it('returns 200 listing by vendorId without authenticated user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    hoisted.bookingCount.mockResolvedValue(1);
    hoisted.bookingFindMany.mockResolvedValue([
      {
        ...baseHydratedBooking(),
        userId: 'other-user',
      },
    ]);
    const req = new NextRequest('http://localhost/api/bookings?vendorId=ven-1');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(200);
    expect(hoisted.bookingCount).toHaveBeenCalledWith({
      where: { vendorId: 'ven-1' },
    });
    const j = await readJson(res);
    const bookings = j.bookings as unknown[];
    expect(bookings).toHaveLength(1);
  });

  it('scopes user listing to auth user when query userId differs', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('alice');
    hoisted.bookingCount.mockResolvedValue(0);
    hoisted.bookingFindMany.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/bookings?userId=bob');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(200);
    expect(hoisted.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'alice' }),
      })
    );
  });

  it('returns 200 with pagination and mapped contracts', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.bookingCount.mockResolvedValue(1);
    hoisted.bookingFindMany.mockResolvedValue([baseHydratedBooking()]);
    const req = new NextRequest('http://localhost/api/bookings?userId=customer-1&page=1&limit=10');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect((j.pagination as { page: number; total: number }).page).toBe(1);
    expect((j.pagination as { total: number }).total).toBe(1);
    const bookings = j.bookings as Record<string, unknown>[];
    expect(bookings[0].user_id).toBe('customer-1');
    expect(bookings[0].total_price).toBe(99);
  });
});

describe('POST /api/bookings', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(checkVendorSlotAvailability).mockReset();
    vi.mocked(checkVendorSlotAvailability).mockResolvedValue({ available: true });
    hoisted.vendorFindUnique.mockReset();
    hoisted.serviceFindFirst.mockReset();
    hoisted.serviceFindUnique.mockReset();
    hoisted.serviceCreate.mockReset();
    hoisted.bookingCreate.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.userFindFirst.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userCreate.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.queryRaw.mockReset();
    hoisted.vendorMembershipFindFirst.mockResolvedValue(null);
    hoisted.userFindFirst.mockResolvedValue(null);
    hoisted.userFindUnique.mockResolvedValue(null);
    hoisted.userCreate.mockResolvedValue({ id: 'placeholder-user-1' });
    hoisted.reviewFindFirst.mockResolvedValue(null);
    hoisted.queryRaw.mockResolvedValue([]);
  });

  it('returns 400 when vendor_id is missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    const res = await bookingsCreatePOST(
      jsonRequest('http://localhost/api/bookings', { service_id: 'svc-1' }, 'POST')
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j.error).toBe('vendor_id is required');
  });

  it('returns 404 when vendor does not exist', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.vendorFindUnique.mockResolvedValue(null);
    const res = await bookingsCreatePOST(
      jsonRequest('http://localhost/api/bookings', { vendor_id: 'missing-ven' }, 'POST')
    );
    expect(res.status).toBe(404);
    expect(hoisted.serviceFindFirst).not.toHaveBeenCalled();
  });

  it('returns 401 when user context is missing after vendor resolution', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        { vendor_id: 'ven-1', service_id: 'svc-1' },
        'POST'
      )
    );
    expect(res.status).toBe(401);
    expect(hoisted.bookingCreate).not.toHaveBeenCalled();
  });

  it('returns 409 SLOT_UNAVAILABLE when slot check fails', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    vi.mocked(checkVendorSlotAvailability).mockResolvedValue({
      available: false,
      reason: 'Slot taken',
    });
    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-08-01',
          booking_time: '10:00:00',
        },
        'POST'
      )
    );
    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('SLOT_UNAVAILABLE');
    expect(hoisted.bookingCreate).not.toHaveBeenCalled();
  });

  it('persists customerMetadata JSON string and explicit amount on happy path', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'new-book' });
    const metaStr = JSON.stringify({
      user_notes: 'Please bring supplies',
      client_email: 'pat@example.com',
      client_phone: '555-0100',
      custom_fields: { service_address: '1 Main St' },
    });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'new-book',
        amount: 150,
        customerMetadata: metaStr,
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-08-01',
          booking_time: '14:00:00',
          title: 'Office clean',
          client_name: 'Pat',
          user_notes: 'Please bring supplies',
          client_email: 'pat@example.com',
          client_phone: '555-0100',
          custom_fields: { service_address: '1 Main St' },
          amount: 150,
        },
        'POST'
      )
    );
    expect(res.status).toBe(200);
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: 'ven-1',
        serviceId: 'svc-1',
        userId: 'customer-1',
        amount: 150,
        customerMetadata: metaStr,
      }),
    });
    const j = await readJson(res);
    const booking = j.booking as Record<string, unknown>;
    const cm = booking.customer_metadata as Record<string, unknown>;
    expect(cm.user_notes).toBe('Please bring supplies');
    expect(cm.client_email).toBe('pat@example.com');
    expect(booking.total_price).toBe(150);
    expect((j.meta as { user_notes?: string }).user_notes).toBe('Please bring supplies');
  });

  it('resolves amount from service price when amount omitted', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.serviceFindUnique.mockResolvedValue({ price: 88 });
    hoisted.bookingCreate.mockResolvedValue({ id: 'book-price' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({ id: 'book-price', amount: 88, serviceId: 'svc-1' })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        { vendor_id: 'ven-1', service_id: 'svc-1', booking_date: '2024-09-01', booking_time: '09:00:00' },
        'POST'
      )
    );
    expect(res.status).toBe(200);
    expect(hoisted.serviceFindUnique).toHaveBeenCalledWith({
      where: { id: 'svc-1' },
      select: { price: true },
    });
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 88 }),
    });
  });

  it('links vendor-staff-created bookings to the customer user resolved from client_email', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userFindFirst.mockResolvedValue({ id: 'customer-by-email' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'vendor-created-book' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'vendor-created-book',
        userId: 'customer-by-email',
        title: 'Fade Haircut',
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-09-02',
          booking_time: '10:00:00',
          title: 'Fade Haircut',
          client_name: 'Alex',
          client_email: 'alex@example.com',
        },
        'POST'
      )
    );
    expect(res.status).toBe(200);
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: 'ven-1',
        serviceId: 'svc-1',
        userId: 'customer-by-email',
      }),
    });
    expect(hoisted.queryRaw).not.toHaveBeenCalled();
  });

  it('creates an unclaimed booking placeholder when client_email has no existing account', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userFindFirst.mockResolvedValue(null);
    hoisted.queryRaw.mockResolvedValue([]);
    hoisted.userCreate.mockResolvedValue({ id: 'placeholder-customer-1' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'vendor-created-book' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'vendor-created-book',
        userId: 'placeholder-customer-1',
        customerMetadata: JSON.stringify({
          client_email: 'new-customer@example.com',
          claim_status: 'UNCLAIMED',
          claim_contact_email: 'new-customer@example.com',
        }),
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-09-02',
          booking_time: '10:00:00',
          title: 'Walk-in',
          client_name: 'New Customer',
          client_email: 'new-customer@example.com',
        },
        'POST'
      )
    );

    expect(res.status).toBe(200);
    expect(hoisted.userCreate).toHaveBeenCalled();
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'placeholder-customer-1',
        customerMetadata: expect.stringContaining('"claim_status":"UNCLAIMED"'),
      }),
    });
  });

  it('creates an unclaimed booking placeholder when vendor staff provides only client_phone', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userCreate.mockResolvedValue({ id: 'placeholder-customer-phone' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'book-phone-only' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'book-phone-only',
        userId: 'placeholder-customer-phone',
        customerMetadata: JSON.stringify({
          client_name: 'Alex Rivera',
          client_phone: '4079148888',
          claim_status: 'UNCLAIMED',
        }),
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-09-02',
          booking_time: '10:00:00',
          title: 'Walk-in',
          client_name: 'Alex Rivera',
          client_phone: '4079148888',
        },
        'POST'
      )
    );
    expect(res.status).toBe(200);
    expect(hoisted.userCreate).toHaveBeenCalled();
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'placeholder-customer-phone',
        customerMetadata: expect.stringContaining('"client_phone":"4079148888"'),
      }),
    });
  });

  it('returns 400 CLIENT_CONTACT_REQUIRED when vendor staff omits client_email and client_phone', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          booking_date: '2024-09-02',
          booking_time: '10:00:00',
          title: 'Walk-in',
          client_name: 'Alex Rivera',
        },
        'POST'
      )
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j.code).toBe('CLIENT_CONTACT_REQUIRED');
    expect(hoisted.bookingCreate).not.toHaveBeenCalled();
  });
});

describe('GET /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await bookingDetailGET(jsonRequest('http://localhost/api/bookings/b1'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when booking missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue(null);
    const res = await bookingDetailGET(jsonRequest('http://localhost/api/bookings/x'), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when booking belongs to another user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({
      ...baseHydratedBooking(),
      userId: 'other',
    });
    const res = await bookingDetailGET(jsonRequest('http://localhost/api/bookings/book-1'), {
      params: Promise.resolve({ id: 'book-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with contract for owner', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.bookingFindUnique.mockResolvedValue(baseHydratedBooking());
    const res = await bookingDetailGET(jsonRequest('http://localhost/api/bookings/book-1'), {
      params: Promise.resolve({ id: 'book-1' }),
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    const booking = j.booking as Record<string, unknown>;
    expect(booking.id).toBe('book-1');
    expect(booking.user_id).toBe('customer-1');
  });
});

describe('PUT /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await bookingPutPUT(jsonRequest('http://localhost/api/bookings/b1', { status: 'confirmed' }, 'PUT'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when not owner', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'other' });
    const res = await bookingPutPUT(jsonRequest('http://localhost/api/bookings/b1', { title: 'X' }, 'PUT'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it('returns 200 and uppercases status; applies title and client_name', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'book-1', userId: 'customer-1' });
    const updated = baseHydratedBooking({
      status: 'CONFIRMED',
      title: 'Updated title',
      clientName: 'Sam',
    });
    hoisted.bookingUpdate.mockResolvedValue(updated);
    const res = await bookingPutPUT(
      jsonRequest(
        'http://localhost/api/bookings/book-1',
        { status: 'confirmed', title: 'Updated title', client_name: 'Sam' },
        'PUT'
      ),
      { params: Promise.resolve({ id: 'book-1' }) }
    );
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          title: 'Updated title',
          clientName: 'Sam',
        }),
      })
    );
    const j = await readJson(res);
    expect((j.booking as { status: string }).status).toBe('confirmed');
  });
});

describe('DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await bookingDeleteDELETE(jsonRequest('http://localhost/api/bookings/b1', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when booking missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue(null);
    const res = await bookingDeleteDELETE(jsonRequest('http://localhost/api/bookings/missing', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when not owner', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'other' });
    const res = await bookingDeleteDELETE(jsonRequest('http://localhost/api/bookings/b1', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 and sets status CANCELED', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'book-1', userId: 'customer-1' });
    hoisted.bookingUpdate.mockResolvedValue({});
    const res = await bookingDeleteDELETE(
      jsonRequest('http://localhost/api/bookings/book-1', undefined, 'DELETE'),
      { params: Promise.resolve({ id: 'book-1' }) }
    );
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'CANCELED' },
    });
    const j = await readJson(res);
    expect(j.success).toBe(true);
  });
});
