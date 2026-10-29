import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const hoisted = vi.hoisted(() => ({
  getVendorAvailabilitySlots: vi.fn(),
  requireVendorManager: vi.fn(),
  vendorFindFirst: vi.fn(),
  serviceFindFirst: vi.fn(),
}));

vi.mock('@/lib/availability-slots', () => ({
  getVendorAvailabilitySlots: hoisted.getVendorAvailabilitySlots,
}));
vi.mock('@/lib/membership-auth', () => ({
  requireVendorManager: hoisted.requireVendorManager,
}));
vi.mock('@/server/db', () => ({
  prisma: {
    vendor: { findFirst: hoisted.vendorFindFirst },
    service: { findFirst: hoisted.serviceFindFirst },
  },
}));

import { GET, PUT } from './route';

describe('vendor availability route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.vendorFindFirst.mockResolvedValue({ id: 'vendor-1' });
    hoisted.serviceFindFirst.mockResolvedValue({ id: 'service-1' });
    hoisted.getVendorAvailabilitySlots.mockResolvedValue({
      availability: {
        vendor_id: 'vendor-1',
        schedule_configured: true,
        schedule_mode: 'CUSTOMER_SELECTS_TIME',
        dates: [],
      },
    });
  });

  it('allows a public customer read for a listed vendor and published service', async () => {
    const response = await GET(
      new NextRequest('https://beta.relianceonline.org/api/availability/vendor/vendor-1?serviceId=service-1'),
      { params: Promise.resolve({ vendorId: 'vendor-1' }) },
    );

    expect(response.status).toBe(200);
    expect(hoisted.requireVendorManager).not.toHaveBeenCalled();
    expect(hoisted.getVendorAvailabilitySlots).toHaveBeenCalledWith(expect.objectContaining({
      vendorId: 'vendor-1',
      serviceId: 'service-1',
    }));
  });

  it('does not expose availability for an unpublished or unrelated service', async () => {
    hoisted.serviceFindFirst.mockResolvedValue(null);
    const response = await GET(
      new NextRequest('https://beta.relianceonline.org/api/availability/vendor/vendor-1?serviceId=private-service'),
      { params: Promise.resolve({ vendorId: 'vendor-1' }) },
    );

    expect(response.status).toBe(404);
    expect(hoisted.getVendorAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('keeps availability mutations behind vendor-manager authorization', async () => {
    hoisted.requireVendorManager.mockResolvedValue({ userId: 'manager-1', membershipId: 'membership-1' });
    const response = await PUT(
      new NextRequest('https://beta.relianceonline.org/api/availability/vendor/vendor-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availability_schedule: [], blocked_dates: [] }),
      }),
      { params: Promise.resolve({ vendorId: 'vendor-1' }) },
    );

    expect(response.status).toBe(200);
    expect(hoisted.requireVendorManager).toHaveBeenCalledTimes(1);
  });
});
