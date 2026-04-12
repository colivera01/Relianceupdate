import { prisma } from '@/server/db';

export const DEFAULT_BOOKING_TIMEZONE = 'America/New_York';

type AvailabilityDate = {
  date: string;
  available: boolean;
  slots: Array<{
    time: string;
    available: boolean;
  }>;
};

const DEFAULT_SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

const toIsoDate = (value: Date) => value.toISOString().split('T')[0];
const toIsoTimeHHmm = (value: Date) => value.toISOString().split('T')[1].slice(0, 5);

function parseDateRange(dateFrom?: string | null, dateTo?: string | null) {
  const now = new Date();
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date(start.getTime() + 13 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  return { start, end };
}

export async function getVendorAvailabilitySlots(input: {
  vendorId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  serviceId?: string | null;
}) {
  const range = parseDateRange(input.dateFrom, input.dateTo);
  if (!range) {
    throw new Error('Invalid date range');
  }

  const bookings = await prisma.booking.findMany({
    where: {
      vendorId: input.vendorId,
      status: { notIn: ['CANCELED', 'CANCELLED'] as any },
      scheduledFor: {
        gte: range.start,
        lte: range.end,
      },
      ...(input.serviceId ? { serviceId: String(input.serviceId) } : {}),
    },
    select: {
      scheduledFor: true,
      status: true,
    },
  });

  const reservedByDate = new Map<string, Set<string>>();
  for (const booking of bookings) {
    if (!booking.scheduledFor) continue;
    const d = toIsoDate(booking.scheduledFor);
    const t = toIsoTimeHHmm(booking.scheduledFor);
    if (!reservedByDate.has(d)) reservedByDate.set(d, new Set<string>());
    reservedByDate.get(d)!.add(t);
  }

  const dates: AvailabilityDate[] = [];
  for (let d = new Date(range.start); d <= range.end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    const date = toIsoDate(d);
    const reserved = reservedByDate.get(date) || new Set<string>();
    const slots = DEFAULT_SLOT_TIMES.map((time) => ({
      time,
      available: !reserved.has(time),
    }));
    dates.push({
      date,
      available: slots.some((slot) => slot.available),
      slots,
    });
  }

  return {
    availability: {
      vendor_id: input.vendorId,
      timezone: DEFAULT_BOOKING_TIMEZONE,
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
  const requestedDate = String(input.booking_date || '');
  const requestedTime = String(input.booking_time || '').slice(0, 5);
  if (!requestedDate || !requestedTime) {
    return { available: false, reason: 'booking_date and booking_time are required' };
  }

  const dayStart = new Date(`${requestedDate}T00:00:00`);
  const dayEnd = new Date(`${requestedDate}T23:59:59`);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return { available: false, reason: 'Invalid booking date' };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      vendorId: String(input.vendorId),
      status: { notIn: ['CANCELED', 'CANCELLED'] as any },
      scheduledFor: {
        gte: dayStart,
        lte: dayEnd,
      },
      ...(input.serviceId ? { serviceId: String(input.serviceId) } : {}),
    },
    select: {
      scheduledFor: true,
    },
  });

  const isReserved = bookings.some((booking) => {
    if (!booking.scheduledFor) return false;
    return toIsoTimeHHmm(booking.scheduledFor) === requestedTime;
  });

  if (isReserved) {
    return { available: false, reason: 'Selected slot is no longer available' };
  }
  return { available: true as const };
}
