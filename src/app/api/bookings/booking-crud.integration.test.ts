import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as bookingsListGET, POST as bookingsCreatePOST } from './route';
import { GET as bookingDetailGET, PUT as bookingPutPUT, DELETE as bookingDeleteDELETE } from './[id]/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { checkVendorSlotAvailability } from '@/lib/availability-slots';
import { sendConsentLinkNotification } from '@/lib/notifications/send-consent-link';
import { createVerifiedPermissionRequest } from '@/lib/consent/request-service';
import { deliverVerifiedPermissionRequest } from '@/lib/consent/delivery-service';
import { dispatchQueuedRecordingNotice } from '@/lib/recording/recording-notice';

const hoisted = vi.hoisted(() => {
  const bookingCount = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingFindFirst = vi.fn();
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
  const mediaSessionCreate = vi.fn();
  const consentRecordCreate = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const consentEventCreate = vi.fn();
  const bookingNotificationCreate = vi.fn();
  const bookingNotificationFindUnique = vi.fn();
  const bookingNotificationFindFirst = vi.fn();
  const bookingNotificationUpdateMany = vi.fn();
  const bookingNotificationUpdate = vi.fn();
  const recordingScopeAssessmentCreate = vi.fn();
  const recordingAuthorityRequirementCreateMany = vi.fn();
  const queryRaw = vi.fn();

  const prisma: any = {
    booking: {
      count: bookingCount,
      findMany: bookingFindMany,
      findUnique: bookingFindUnique,
      findFirst: bookingFindFirst,
      create: bookingCreate,
      update: bookingUpdate,
    },
    vendor: { findUnique: vendorFindUnique },
    service: { findFirst: serviceFindFirst, findUnique: serviceFindUnique, create: serviceCreate },
    vendorMembership: { findFirst: vendorMembershipFindFirst },
    user: { findFirst: userFindFirst, findUnique: userFindUnique, create: userCreate },
    review: { findFirst: reviewFindFirst },
    mediaSession: { create: mediaSessionCreate },
    consentRecord: { create: consentRecordCreate, findFirst: consentRecordFindFirst },
    consentEvent: { create: consentEventCreate },
    bookingNotification: {
      create: bookingNotificationCreate,
      findUnique: bookingNotificationFindUnique,
      findFirst: bookingNotificationFindFirst,
      updateMany: bookingNotificationUpdateMany,
      update: bookingNotificationUpdate,
    },
    recordingScopeAssessment: { create: recordingScopeAssessmentCreate },
    recordingAuthorityRequirement: { createMany: recordingAuthorityRequirementCreateMany },
    $queryRaw: queryRaw,
  };
  const transaction = vi.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  prisma.$transaction = transaction;

  return {
    prisma,
    bookingCount,
    bookingFindMany,
    bookingFindUnique,
    bookingFindFirst,
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
    mediaSessionCreate,
    consentRecordCreate,
    consentRecordFindFirst,
    consentEventCreate,
    bookingNotificationCreate,
    bookingNotificationFindUnique,
    bookingNotificationFindFirst,
    bookingNotificationUpdateMany,
    bookingNotificationUpdate,
    recordingScopeAssessmentCreate,
    recordingAuthorityRequirementCreateMany,
    transaction,
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

vi.mock('@/lib/notifications/send-consent-link', () => ({
  sendConsentLinkNotification: vi.fn(),
}));

vi.mock('@/lib/consent/request-service', () => ({
  createVerifiedPermissionRequest: vi.fn(),
}));

vi.mock('@/lib/consent/delivery-service', () => ({
  deliverVerifiedPermissionRequest: vi.fn(),
}));

vi.mock('@/lib/recording/recording-notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recording/recording-notice')>();
  return {
    ...actual,
    dispatchQueuedRecordingNotice: vi.fn(),
  };
});

function jsonRequest(url: string, body?: unknown, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET') {
  const suppliedFields =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (((body as Record<string, unknown>).custom_fields as Record<string, unknown>) || {})
      : {};
  const normalizedBody =
    method === 'POST' &&
    url.endsWith('/api/bookings') &&
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).vendor_id
      ? {
          ...(body as Record<string, unknown>),
          custom_fields: {
            recordingLocation:
              suppliedFields.recordingLocation ||
              suppliedFields.vendor_job_recording_location ||
              'business',
            propertyScope: 'vendor_owned',
            peopleScope: 'none',
            frameControl: 'controlled',
            authorityHolderType: 'vendor_manager',
            serviceCanContinueWithoutRecording: true,
            ...suppliedFields,
          },
        }
      : body;
  return new NextRequest(url, {
    method,
    headers: normalizedBody !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: normalizedBody !== undefined ? JSON.stringify(normalizedBody) : undefined,
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
    hoisted.vendorMembershipFindFirst.mockReset();
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

  it('returns 401 listing by vendorId without authenticated user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/bookings?vendorId=ven-1');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(401);
    expect(hoisted.bookingCount).not.toHaveBeenCalled();
  });

  it('returns 200 listing by vendorId for an active vendor member', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
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

  it('rejects a customer query that attempts to select another user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('alice');
    const req = new NextRequest('http://localhost/api/bookings?userId=bob');
    const res = await bookingsListGET(req);
    expect(res.status).toBe(403);
    expect(hoisted.bookingFindMany).not.toHaveBeenCalled();
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
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.userFindFirst.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userCreate.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.mediaSessionCreate.mockReset();
    hoisted.consentRecordCreate.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.consentEventCreate.mockReset();
    hoisted.bookingNotificationCreate.mockReset();
    hoisted.bookingNotificationFindUnique.mockReset();
    hoisted.bookingNotificationFindFirst.mockReset();
    hoisted.bookingNotificationUpdateMany.mockReset();
    hoisted.bookingNotificationUpdate.mockReset();
    hoisted.recordingScopeAssessmentCreate.mockReset();
    hoisted.recordingAuthorityRequirementCreateMany.mockReset();
    hoisted.transaction.mockReset();
    hoisted.transaction.mockImplementation(async (callback: (tx: typeof hoisted.prisma) => unknown) =>
      callback(hoisted.prisma)
    );
    hoisted.bookingUpdate.mockReset();
    vi.mocked(sendConsentLinkNotification).mockReset();
    hoisted.queryRaw.mockReset();
    hoisted.vendorMembershipFindFirst.mockResolvedValue(null);
    hoisted.userFindFirst.mockResolvedValue(null);
    hoisted.userFindUnique.mockResolvedValue(null);
    hoisted.userCreate.mockResolvedValue({ id: 'placeholder-user-1' });
    hoisted.bookingFindFirst.mockResolvedValue(null);
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    hoisted.bookingNotificationFindUnique.mockResolvedValue(null);
    hoisted.bookingNotificationFindFirst.mockResolvedValue(null);
    hoisted.bookingNotificationCreate.mockResolvedValue({
      id: 'notification-1',
      status: 'QUEUED',
      attemptCount: 0,
    });
    hoisted.bookingNotificationUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.bookingNotificationUpdate.mockResolvedValue({
      id: 'notification-1',
      status: 'SENT',
      attemptCount: 1,
      channelsJson: JSON.stringify([{ channel: 'email', attempted: true, success: true }]),
      lastError: null,
      lastAttemptAt: new Date('2024-07-01T12:00:00.000Z'),
      sentAt: new Date('2024-07-01T12:00:01.000Z'),
    });
    hoisted.recordingScopeAssessmentCreate.mockResolvedValue({
      id: 'assessment-1',
      generation: 1,
      scopeHash: 'scope-hash-1',
    });
    hoisted.recordingAuthorityRequirementCreateMany.mockResolvedValue({ count: 1 });
    hoisted.reviewFindFirst.mockResolvedValue(null);
    hoisted.queryRaw.mockResolvedValue([]);
    vi.mocked(sendConsentLinkNotification).mockResolvedValue({
      anySuccess: true,
      absoluteFallbackLink: 'https://beta.relianceonline.org/consent/token-1',
      channels: [{ channel: 'email', attempted: true, success: true }],
    } as any);
    vi.mocked(dispatchQueuedRecordingNotice).mockReset();
    vi.mocked(dispatchQueuedRecordingNotice).mockResolvedValue({
      claimed: true,
      delivery: {
        status: 'SENT',
        attemptCount: 1,
        channels: [{ channel: 'email', attempted: true, success: true }],
        lastError: null,
        lastAttemptAt: '2024-07-01T12:00:00.000Z',
        sentAt: '2024-07-01T12:00:01.000Z',
      },
    } as any);
    vi.mocked(createVerifiedPermissionRequest).mockReset();
    vi.mocked(createVerifiedPermissionRequest).mockResolvedValue({
      consentRecordId: 'permission-1',
      requestLinkId: 'link-1',
      actionSecret: 'server-only-action-secret',
      actionPath: '/consent/server-only-action-secret',
      notificationId: 'notification-1',
      state: 'pending',
      recipient: {
        name: 'Alex',
        email: 'alex@example.com',
        phone: null,
        emailHash: 'email-hash',
        phoneHash: null,
        emailMasked: 'a***@example.com',
        phoneMasked: null,
      },
      booking: {
        id: 'customer-location-book',
        title: 'Electrical Service Recording Test',
        vendor: { name: 'Vendor', businessName: 'Vendor Co' },
        service: { name: 'Electrical Service' },
      },
      generation: 1,
    } as any);
    vi.mocked(deliverVerifiedPermissionRequest).mockReset();
    vi.mocked(deliverVerifiedPermissionRequest).mockResolvedValue({
      status: 'SENT',
      attemptCount: 1,
      channels: [{ channel: 'email', attempted: true, success: true }],
      lastError: null,
      lastAttemptAt: '2026-07-31T12:00:00.000Z',
      sentAt: '2026-07-31T12:00:01.000Z',
    } as any);
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
      client_name: 'Pat',
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
        customerMetadata: expect.any(String),
      }),
    });
    const persistedMetadata = JSON.parse(
      hoisted.bookingCreate.mock.calls[0][0].data.customerMetadata
    ) as Record<string, any>;
    expect(persistedMetadata).toMatchObject({
      user_notes: 'Please bring supplies',
      client_name: 'Pat',
      client_email: 'pat@example.com',
      client_phone: '555-0100',
      custom_fields: {
        service_address: '1 Main St',
        recordingLocation: 'business',
        propertyScope: 'vendor_owned',
      },
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

  it('allows vendor staff to create a work record for a customer whose account is inactive', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userFindFirst.mockResolvedValue({ id: 'inactive-customer' });
    hoisted.userFindUnique.mockResolvedValue({
      id: 'vendor-user-1',
      accountStatus: 'active',
    });
    hoisted.bookingCreate.mockResolvedValue({ id: 'inactive-customer-book' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'inactive-customer-book',
        userId: 'inactive-customer',
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          client_name: 'Inactive Customer',
          client_email: 'inactive@example.com',
        },
        'POST'
      )
    );

    expect(res.status).toBe(200);
    expect(hoisted.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'inactive-customer' }),
    });
    expect(hoisted.userFindUnique).toHaveBeenCalledTimes(1);
  });

  it('automatically creates and sends a verified permission request for a vendor-created customer-location order', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userFindFirst.mockResolvedValue({ id: 'customer-by-email' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'customer-location-book' });
    hoisted.mediaSessionCreate.mockResolvedValue({ id: 'consent-session-1' });
    hoisted.bookingUpdate.mockResolvedValue({ id: 'customer-location-book' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'customer-location-book',
        userId: 'customer-by-email',
        customerMetadata: JSON.stringify({
          client_email: 'alex@example.com',
          vendor_job_recording_location: 'residence',
        }),
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          title: 'Electrical Service Recording Test',
          client_name: 'Alex',
          client_email: 'alex@example.com',
          custom_fields: { vendor_job_recording_location: 'residence' },
        },
        'POST'
      )
    );

    expect(res.status).toBe(200);
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'customer-location-book',
        sessionType: 'CONSENT_REQUEST',
      }),
    });
    expect(createVerifiedPermissionRequest).toHaveBeenCalledWith({
      bookingId: 'customer-location-book',
      actorUserId: 'vendor-user-1',
      mediaSessionId: 'consent-session-1',
      reason: 'create',
    });
    expect(deliverVerifiedPermissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'notification-1',
        consentRecordId: 'permission-1',
        actionPath: '/consent/server-only-action-secret',
      })
    );
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: true,
      automaticConsent: { status: 'delivered', recordingLocked: true },
    });
    expect(JSON.stringify(json)).not.toContain('server-only-action-secret');
  });

  it('sends notice only and creates no permission request for controlled vendor-owned Level 1 recording', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({
      id: 'ven-1',
      name: 'Vendor',
      businessName: 'Vendor Co',
    });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.serviceFindUnique.mockResolvedValue({ id: 'svc-1', name: 'Outlet installation', price: 0 });
    hoisted.userFindFirst.mockResolvedValue({ id: 'customer-by-email' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'vendor-level-one-book' });
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({
        id: 'vendor-level-one-book',
        userId: 'customer-by-email',
      }),
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          title: 'Outlet installation',
          client_name: 'Alex',
          client_email: 'alex@example.com',
          custom_fields: {
            vendor_job_recording_location: 'business',
            recording_property_scope: 'vendor_owned',
            recording_people_scope: 'none',
            recording_frame_control: 'controlled',
            recording_authority_holder_type: 'vendor_manager',
            service_can_continue_without_recording: true,
          },
        },
        'POST',
      ),
    );

    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(hoisted.bookingNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'vendor-level-one-book',
        kind: 'CUSTOMER_RECORDING_NOTICE:1',
        status: 'QUEUED',
      }),
    });
    expect(dispatchQueuedRecordingNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'vendor-level-one-book',
        customerEmail: 'alex@example.com',
      }),
    );
    expect(createVerifiedPermissionRequest).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
    expect(json).toMatchObject({
      success: true,
      automaticConsent: null,
      recordingNotice: {
        status: 'SENT',
        responseRequired: false,
        recordingPermissionCreated: false,
      },
    });
  });

  it('returns the existing work record when the same creation key is retried', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({ id: 'ven-1' });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.bookingFindFirst.mockResolvedValue(
      baseHydratedBooking({
        id: 'already-created',
        vendorId: 'ven-1',
        userId: 'customer-1',
      })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          client_name: 'Alex',
          client_email: 'alex@example.com',
          idempotency_key: 'stable-create-key',
        },
        'POST'
      )
    );

    expect(res.status).toBe(200);
    expect(hoisted.bookingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creationRequestKey: 'stable-create-key' } })
    );
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.bookingCreate).not.toHaveBeenCalled();
    expect(await readJson(res)).toMatchObject({
      success: true,
      idempotentReplay: true,
      booking: { id: 'already-created' },
    });
  });

  it('creates the booking transaction before handing permission creation to the canonical service', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('vendor-user-1');
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: 'mem-1' });
    hoisted.vendorFindUnique.mockResolvedValue({
      id: 'ven-1',
      businessName: 'Vendor Co',
      address: '100 Main St',
      city: 'Orlando',
      state: 'FL',
      zipCode: '32801',
      latitude: 28.54,
      longitude: -81.38,
    });
    hoisted.serviceFindFirst.mockResolvedValueOnce({ id: 'svc-1' });
    hoisted.userFindFirst.mockResolvedValue({ id: 'customer-by-email' });
    hoisted.bookingCreate.mockResolvedValue({ id: 'transaction-book' });
    hoisted.mediaSessionCreate.mockResolvedValue({ id: 'transaction-session' });
    vi.mocked(createVerifiedPermissionRequest).mockResolvedValue({
      consentRecordId: 'transaction-permission',
      requestLinkId: null,
      actionPath: null,
      actionSecret: null,
      notificationId: null,
      state: 'no_digital_channel',
      recipient: {
        name: 'Alex',
        email: null,
        phone: null,
        emailHash: null,
        phoneHash: null,
        emailMasked: null,
        phoneMasked: null,
      },
      booking: { id: 'transaction-book' },
      generation: 1,
    } as any);
    hoisted.bookingFindUnique.mockResolvedValue(
      baseHydratedBooking({ id: 'transaction-book', userId: 'customer-by-email' })
    );

    const res = await bookingsCreatePOST(
      jsonRequest(
        'http://localhost/api/bookings',
        {
          vendor_id: 'ven-1',
          service_id: 'svc-1',
          client_name: 'Alex',
          client_email: 'alex@example.com',
          custom_fields: { vendor_job_recording_location: 'customer-business' },
        },
        'POST'
      )
    );

    expect(res.status).toBe(200);
    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.bookingCreate).toHaveBeenCalledTimes(1);
    expect(createVerifiedPermissionRequest).toHaveBeenCalledTimes(1);
    expect(hoisted.consentRecordCreate).not.toHaveBeenCalled();
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
