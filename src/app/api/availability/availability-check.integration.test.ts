import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as availabilityCheckPOST } from './check/route';

const hoisted = vi.hoisted(() => {
  const bookingFindMany = vi.fn();
  const vendorFindUnique = vi.fn();
  const serviceFindFirst = vi.fn();
  const prisma = {
    booking: { findMany: bookingFindMany },
    vendor: { findUnique: vendorFindUnique },
    service: { findFirst: serviceFindFirst },
  };
  return { prisma, bookingFindMany, vendorFindUnique, serviceFindFirst };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

function postJson(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/availability/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/availability/check', () => {
  beforeEach(() => {
    hoisted.bookingFindMany.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.serviceFindFirst.mockReset();
    hoisted.vendorFindUnique.mockResolvedValue({
      businessHoursJson: JSON.stringify({
        timezone: 'America/New_York',
        days: [
          { day: 'mon', enabled: true, open: '09:00', close: '17:00' },
          { day: 'tue', enabled: true, open: '09:00', close: '17:00' },
          { day: 'wed', enabled: true, open: '09:00', close: '17:00' },
          { day: 'thu', enabled: true, open: '09:00', close: '17:00' },
          { day: 'fri', enabled: true, open: '09:00', close: '17:00' },
          { day: 'sat', enabled: false, open: '09:00', close: '17:00' },
          { day: 'sun', enabled: false, open: '09:00', close: '17:00' },
        ],
      }),
    });
    hoisted.serviceFindFirst.mockResolvedValue({ description: 'Estimated duration: 60 minutes.' });
  });

  it('returns 400 when vendorId is missing', async () => {
    const res = await availabilityCheckPOST(
      postJson({ booking_date: '2024-08-01', booking_time: '10:00:00' })
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j.available).toBe(false);
    expect(String(j.reason)).toContain('vendorId');
    expect(hoisted.bookingFindMany).not.toHaveBeenCalled();
  });

  it('returns 400 when booking_date is missing', async () => {
    const res = await availabilityCheckPOST(
      postJson({ vendorId: 'ven-1', booking_time: '10:00:00' })
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j.available).toBe(false);
  });

  it('returns 400 when booking_time is missing', async () => {
    const res = await availabilityCheckPOST(postJson({ vendorId: 'ven-1', booking_date: '2024-08-01' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 with available true when no conflicting bookings (real slot helper)', async () => {
    hoisted.bookingFindMany.mockResolvedValue([]);
    const res = await availabilityCheckPOST(
      postJson({
        vendorId: 'ven-1',
        serviceId: 'svc-1',
        booking_date: '2026-11-05',
        booking_time: '11:00:00',
      })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.available).toBe(true);
    expect(hoisted.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: 'ven-1',
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        }),
      })
    );
  });

  it('returns 200 with available false when slot is reserved (same HH:mm)', async () => {
    hoisted.bookingFindMany.mockResolvedValue([
      { scheduledFor: new Date('2026-11-05T16:00:00.000Z'), service: { description: 'Estimated duration: 60 minutes.' } },
    ]);
    const res = await availabilityCheckPOST(
      postJson({
        vendorId: 'ven-1',
        booking_date: '2026-11-05',
        booking_time: '11:00:00',
      })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.available).toBe(false);
    expect(String(j.reason)).toMatch(/no longer available|unavailable/i);
  });

  it('passes serviceId as undefined in findMany when omitted from body', async () => {
    hoisted.bookingFindMany.mockResolvedValue([]);
    await availabilityCheckPOST(
      postJson({
        vendorId: 'ven-1',
        booking_date: '2026-11-05',
        booking_time: '09:00:00',
      })
    );
    const arg = hoisted.bookingFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.serviceId).toBeUndefined();
  });
});
