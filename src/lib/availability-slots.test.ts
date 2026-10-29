import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  vendorFindUnique: vi.fn(),
  serviceFindFirst: vi.fn(),
  bookingFindMany: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    vendor: { findUnique: db.vendorFindUnique },
    service: { findFirst: db.serviceFindFirst },
    booking: { findMany: db.bookingFindMany },
  },
}));

import {
  checkVendorSlotAvailability,
  getVendorAvailabilitySlots,
  parseSavedBusinessHours,
  resolveServiceDurationMinutes,
} from './availability-slots';

function savedHours() {
  return JSON.stringify({
    timezone: 'America/New_York',
    days: [
      { day: 'mon', enabled: true, open: '09:00', close: '12:00' },
      { day: 'tue', enabled: false, open: '09:00', close: '12:00' },
      { day: 'wed', enabled: false, open: '09:00', close: '12:00' },
      { day: 'thu', enabled: false, open: '09:00', close: '12:00' },
      { day: 'fri', enabled: false, open: '09:00', close: '12:00' },
      { day: 'sat', enabled: false, open: '09:00', close: '12:00' },
      { day: 'sun', enabled: false, open: '09:00', close: '12:00' },
    ],
  });
}

describe('vendor availability slots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z'));
    db.vendorFindUnique.mockReset();
    db.serviceFindFirst.mockReset();
    db.bookingFindMany.mockReset();
    db.serviceFindFirst.mockResolvedValue({ description: 'Estimated duration: 60 minutes.' });
    db.bookingFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses provider-proposal mode when no hours have actually been saved', async () => {
    db.vendorFindUnique.mockResolvedValue({ businessHoursJson: null });

    const result = await getVendorAvailabilitySlots({
      vendorId: 'vendor-1',
      serviceId: 'service-1',
      dateFrom: '2026-11-02',
      dateTo: '2026-11-02',
    });

    expect(result.availability).toMatchObject({
      schedule_configured: false,
      schedule_mode: 'VENDOR_TO_PROPOSE',
      timezone: 'America/New_York',
      service_duration_minutes: 60,
      dates: [],
    });
    expect(db.bookingFindMany).not.toHaveBeenCalled();
  });

  it('uses saved closed days and service duration instead of fabricated default slots', async () => {
    db.vendorFindUnique.mockResolvedValue({ businessHoursJson: savedHours() });

    const result = await getVendorAvailabilitySlots({
      vendorId: 'vendor-1',
      serviceId: 'service-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-02',
    });

    const sunday = result.availability.dates.find((day) => day.date === '2026-11-01');
    const monday = result.availability.dates.find((day) => day.date === '2026-11-02');
    expect(sunday).toEqual({ date: '2026-11-01', available: false, slots: [] });
    expect(monday?.slots.map((slot) => slot.time)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('blocks overlaps from every service owned by the vendor', async () => {
    db.vendorFindUnique.mockResolvedValue({ businessHoursJson: savedHours() });
    db.bookingFindMany.mockResolvedValue([
      {
        scheduledFor: new Date('2026-11-02T14:30:00.000Z'),
        service: { description: 'Estimated duration: 60 minutes.' },
      },
    ]);

    const result = await checkVendorSlotAvailability({
      vendorId: 'vendor-1',
      serviceId: 'service-1',
      booking_date: '2026-11-02',
      booking_time: '09:00',
    });

    expect(result).toMatchObject({ available: false, reason: 'Selected slot is no longer available' });
    const where = db.bookingFindMany.mock.calls[0][0].where;
    expect(where.vendorId).toBe('vendor-1');
    expect(where).not.toHaveProperty('serviceId');
  });

  it('returns a canonical UTC instant for a valid saved-hours slot', async () => {
    db.vendorFindUnique.mockResolvedValue({ businessHoursJson: savedHours() });

    const result = await checkVendorSlotAvailability({
      vendorId: 'vendor-1',
      serviceId: 'service-1',
      booking_date: '2026-11-02',
      booking_time: '10:30',
    });

    expect(result).toMatchObject({
      available: true,
      schedule_mode: 'CUSTOMER_SELECTS_TIME',
      scheduled_for: '2026-11-02T15:30:00.000Z',
      timezone: 'America/New_York',
    });
  });

  it('treats malformed saved-hours data as unconfigured and parses duration honestly', () => {
    expect(parseSavedBusinessHours('{not-json')).toBeNull();
    expect(resolveServiceDurationMinutes('Estimated duration: 1.5 hours.')).toBe(90);
    expect(resolveServiceDurationMinutes('No duration listed')).toBe(60);
  });
});
