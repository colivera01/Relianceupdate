import { prisma } from '@/server/db';
import {
  normalizeBusinessHours,
  type BusinessHoursDayKey,
  type BusinessHoursSchedule,
} from '@/lib/business-hours';
import { dateAndTimeInZone, zonedDateTimeToUtc } from '@/lib/booking-schedule';

export const DEFAULT_BOOKING_TIMEZONE = 'America/New_York';
export const DEFAULT_SERVICE_DURATION_MINUTES = 60;
export const BOOKING_SLOT_INTERVAL_MINUTES = 30;
export const MINIMUM_BOOKING_LEAD_MINUTES = 60;

type AvailabilityDate = {
  date: string;
  available: boolean;
  slots: Array<{
    time: string;
    available: boolean;
  }>;
};

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];
const DAY_KEYS: BusinessHoursDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * A persisted schedule is configured only when the stored value is valid JSON
 * with an explicit `days` array. This intentionally does not use the profile
 * editor's suggested weekday defaults for a vendor that has never saved hours.
 */
export function parseSavedBusinessHours(value: unknown): BusinessHoursSchedule | null {
  if (value == null || String(value).trim() === '') return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!Array.isArray((parsed as Record<string, unknown>).days)) return null;
  return normalizeBusinessHours(parsed);
}

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').slice(0, 5));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeFromMinutes(value: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function addIsoDays(value: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function dayKeyForIsoDate(value: string): BusinessHoursDayKey | null {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return DAY_KEYS[parsed.getUTCDay()] || null;
}

function parseDateRange(dateFrom: string | null | undefined, dateTo: string | null | undefined, timeZone: string) {
  const today = dateAndTimeInZone(new Date(), timeZone).date;
  const startDate = String(dateFrom || today).trim();
  const defaultEnd = addIsoDays(startDate, 13);
  const endDate = String(dateTo || defaultEnd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const start = zonedDateTimeToUtc({ date: startDate, time: '00:00', timeZone });
  const dayAfterEnd = addIsoDays(endDate, 1);
  const endExclusive = dayAfterEnd
    ? zonedDateTimeToUtc({ date: dayAfterEnd, time: '00:00', timeZone })
    : null;
  if (!start || !endExclusive || endExclusive <= start) return null;
  const dayCount = Math.round((new Date(`${endDate}T12:00:00Z`).getTime() - new Date(`${startDate}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(dayCount) || dayCount < 1 || dayCount > 31) return null;
  return { startDate, endDate, start, endExclusive, dayCount };
}

export function resolveServiceDurationMinutes(description: unknown): number {
  const text = String(description || '');
  const match = /(?:estimated\s+)?duration\s*:\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)/i.exec(text);
  if (!match) return DEFAULT_SERVICE_DURATION_MINUTES;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_SERVICE_DURATION_MINUTES;
  const minutes = /^h/i.test(match[2]) ? numeric * 60 : numeric;
  return Math.max(15, Math.min(480, Math.ceil(minutes / 15) * 15));
}

export function bookingIntervalsOverlap(startA: Date, durationA: number, startB: Date, durationB: number): boolean {
  const endA = startA.getTime() + durationA * 60_000;
  const endB = startB.getTime() + durationB * 60_000;
  return startA.getTime() < endB && startB.getTime() < endA;
}

function conflictsWithBookings(
  start: Date,
  durationMinutes: number,
  bookings: Array<{ scheduledFor: Date | null; service?: { description?: string | null } | null }>,
): boolean {
  return bookings.some((booking) =>
    booking.scheduledFor
      ? bookingIntervalsOverlap(
          start,
          durationMinutes,
          booking.scheduledFor,
          resolveServiceDurationMinutes(booking.service?.description),
        )
      : false,
  );
}

export async function getVendorAvailabilitySlots(input: {
  vendorId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  serviceId?: string | null;
}) {
  const [vendor, service] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { businessHoursJson: true },
    }),
    input.serviceId
      ? prisma.service.findFirst({
          where: { id: String(input.serviceId), vendorId: input.vendorId },
          select: { description: true },
        })
      : Promise.resolve(null),
  ]);
  if (!vendor) throw new Error('Vendor not found');

  const schedule = parseSavedBusinessHours(vendor.businessHoursJson);
  const timeZone = schedule?.timezone || DEFAULT_BOOKING_TIMEZONE;
  const range = parseDateRange(input.dateFrom, input.dateTo, timeZone);
  if (!range) {
    throw new Error('Invalid date range');
  }

  if (!schedule) {
    return {
      availability: {
        vendor_id: input.vendorId,
        timezone: timeZone,
        schedule_configured: false,
        schedule_mode: 'VENDOR_TO_PROPOSE' as const,
        service_duration_minutes: resolveServiceDurationMinutes(service?.description),
        dates: [] as AvailabilityDate[],
      },
    };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      vendorId: input.vendorId,
      status: { in: ACTIVE_BOOKING_STATUSES as any },
      scheduledFor: {
        // An earlier long-running service can overlap the first candidate slot.
        gte: new Date(range.start.getTime() - 8 * 60 * 60 * 1000),
        lt: range.endExclusive,
      },
    },
    select: {
      scheduledFor: true,
      status: true,
      service: { select: { description: true } },
    },
  });

  const dates: AvailabilityDate[] = [];
  const durationMinutes = resolveServiceDurationMinutes(service?.description);
  const earliest = Date.now() + MINIMUM_BOOKING_LEAD_MINUTES * 60_000;
  for (let offset = 0; offset < range.dayCount; offset += 1) {
    const date = addIsoDays(range.startDate, offset)!;
    const dayKey = dayKeyForIsoDate(date);
    const hours = schedule.days.find((entry) => entry.day === dayKey);
    const open = hours?.enabled ? minutesFromTime(hours.open) : null;
    const close = hours?.enabled ? minutesFromTime(hours.close) : null;
    const slots: AvailabilityDate['slots'] = [];
    if (open != null && close != null && close > open) {
      for (let minute = open; minute + durationMinutes <= close; minute += BOOKING_SLOT_INTERVAL_MINUTES) {
        const time = timeFromMinutes(minute);
        const start = zonedDateTimeToUtc({ date, time, timeZone });
        const available = Boolean(
          start &&
            start.getTime() >= earliest &&
            !conflictsWithBookings(start, durationMinutes, bookings),
        );
        slots.push({ time, available });
      }
    }
    dates.push({
      date,
      available: slots.some((slot) => slot.available),
      slots,
    });
  }

  return {
    availability: {
      vendor_id: input.vendorId,
      timezone: timeZone,
      schedule_configured: true,
      schedule_mode: 'CUSTOMER_SELECTS_TIME' as const,
      service_duration_minutes: durationMinutes,
      dates,
    },
  };
}

export async function checkVendorSlotAvailability(input: {
  vendorId: string;
  serviceId?: string | null;
  booking_date: string;
  booking_time: string;
}) {
  const requestedDate = String(input.booking_date || '').trim();
  const requestedTime = String(input.booking_time || '').slice(0, 5);
  if (!requestedDate || !requestedTime) {
    return { available: false, reason: 'booking_date and booking_time are required' };
  }

  const [vendor, service] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: String(input.vendorId) },
      select: { businessHoursJson: true },
    }),
    input.serviceId
      ? prisma.service.findFirst({
          where: { id: String(input.serviceId), vendorId: String(input.vendorId) },
          select: { description: true },
        })
      : Promise.resolve(null),
  ]);
  if (!vendor) return { available: false, reason: 'Vendor not found' };
  const schedule = parseSavedBusinessHours(vendor.businessHoursJson);
  if (!schedule) {
    return {
      available: false,
      reason: 'This provider has not published booking hours and must propose the service time.',
      schedule_mode: 'VENDOR_TO_PROPOSE' as const,
    };
  }

  const timeZone = schedule.timezone || DEFAULT_BOOKING_TIMEZONE;
  const requestedStart = zonedDateTimeToUtc({ date: requestedDate, time: requestedTime, timeZone });
  const requestedMinutes = minutesFromTime(requestedTime);
  const dayKey = dayKeyForIsoDate(requestedDate);
  const hours = schedule.days.find((entry) => entry.day === dayKey);
  const open = hours?.enabled ? minutesFromTime(hours.open) : null;
  const close = hours?.enabled ? minutesFromTime(hours.close) : null;
  const durationMinutes = resolveServiceDurationMinutes(service?.description);
  if (
    !requestedStart ||
    requestedMinutes == null ||
    open == null ||
    close == null ||
    requestedMinutes < open ||
    requestedMinutes + durationMinutes > close ||
    (requestedMinutes - open) % BOOKING_SLOT_INTERVAL_MINUTES !== 0
  ) {
    return { available: false, reason: 'Selected time is outside the provider’s published booking hours' };
  }
  if (requestedStart.getTime() < Date.now() + MINIMUM_BOOKING_LEAD_MINUTES * 60_000) {
    return { available: false, reason: 'Selected time is too soon or already in the past' };
  }

  const dayAfter = addIsoDays(requestedDate, 1);
  const dayStart = zonedDateTimeToUtc({ date: requestedDate, time: '00:00', timeZone });
  const dayEnd = dayAfter ? zonedDateTimeToUtc({ date: dayAfter, time: '00:00', timeZone }) : null;
  if (!dayStart || !dayEnd) return { available: false, reason: 'Invalid booking date' };
  const bookings = await prisma.booking.findMany({
    where: {
      vendorId: String(input.vendorId),
      status: { in: ACTIVE_BOOKING_STATUSES as any },
      scheduledFor: {
        gte: new Date(dayStart.getTime() - 8 * 60 * 60 * 1000),
        lt: dayEnd,
      },
    },
    select: {
      scheduledFor: true,
      service: { select: { description: true } },
    },
  });

  if (conflictsWithBookings(requestedStart, durationMinutes, bookings)) {
    return { available: false, reason: 'Selected slot is no longer available' };
  }
  return {
    available: true as const,
    schedule_mode: 'CUSTOMER_SELECTS_TIME' as const,
    scheduled_for: requestedStart.toISOString(),
    timezone: timeZone,
    service_duration_minutes: durationMinutes,
  };
}
