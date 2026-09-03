import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './[id]/organization/route';
import { getUserIdFromRequest } from '@/lib/auth';

const hoisted = vi.hoisted(() => ({
  change: vi.fn(),
  ensureAccount: vi.fn(),
}));

vi.mock('@/server/db', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock('@/lib/account-status', () => ({
  AccountStatusError: class AccountStatusError extends Error { statusCode = 403; },
  accountStatusErrorBody: (error: Error) => ({ error: error.message }),
  ensureUserAccountCanAct: hoisted.ensureAccount,
}));
vi.mock('@/lib/customer-service-record-organization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/customer-service-record-organization')>();
  return { ...actual, changeCustomerServiceRecordOrganization: hoisted.change };
});

function request(body: unknown) {
  return new NextRequest('http://localhost/api/bookings/booking-1/organization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/bookings/[id]/organization', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.ensureAccount.mockReset();
    hoisted.ensureAccount.mockResolvedValue(undefined);
    hoisted.change.mockReset();
    hoisted.change.mockResolvedValue({ event: { id: 'event-1' }, idempotent: false });
  });

  it('requires authenticated customer ownership context', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const response = await POST(request({ action: 'ARCHIVE', requestId: 'request-1' }), { params: Promise.resolve({ id: 'booking-1' }) });
    expect(response.status).toBe(401);
    expect(hoisted.change).not.toHaveBeenCalled();
  });

  it('validates the finite action and idempotency key', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    const badAction = await POST(request({ action: 'DELETE', requestId: 'request-1' }), { params: Promise.resolve({ id: 'booking-1' }) });
    const missingRequest = await POST(request({ action: 'ARCHIVE' }), { params: Promise.resolve({ id: 'booking-1' }) });
    expect(badAction.status).toBe(422);
    expect(missingRequest.status).toBe(422);
    expect(hoisted.change).not.toHaveBeenCalled();
  });

  it('passes exact customer, booking, action, and request identity to the transactional service', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    const response = await POST(request({ action: 'archive', requestId: 'request-1' }), { params: Promise.resolve({ id: 'booking-1' }) });
    expect(response.status).toBe(200);
    expect(hoisted.change).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'booking-1',
      customerUserId: 'customer-1',
      action: 'ARCHIVE',
      requestId: 'request-1',
    }));
    await expect(response.json()).resolves.toMatchObject({ organization: 'ARCHIVED', eventId: 'event-1' });
  });

  it('returns fail-closed ownership and legacy restore errors', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.change.mockRejectedValueOnce(new Error('CUSTOMER_SERVICE_RECORD_FORBIDDEN'));
    const denied = await POST(request({ action: 'ARCHIVE', requestId: 'request-1' }), { params: Promise.resolve({ id: 'booking-1' }) });
    expect(denied.status).toBe(403);

    hoisted.change.mockRejectedValueOnce(new Error('LEGACY_ARCHIVE_RESTORE_UNAVAILABLE'));
    const legacy = await POST(request({ action: 'RESTORE', requestId: 'request-2' }), { params: Promise.resolve({ id: 'booking-1' }) });
    expect(legacy.status).toBe(409);
  });
});
