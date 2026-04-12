// Focused runtime contract checks for availability + booking conflict guard.

type AvailabilitySlot = {
  time: string;
  available: boolean;
};

type AvailabilityDate = {
  date: string;
  available: boolean;
  slots: AvailabilitySlot[];
};

type AvailabilityReadResponse = {
  availability: {
    vendor_id: string;
    timezone: string;
    dates: AvailabilityDate[];
  };
};

type AvailabilityCheckResponse = {
  available: boolean;
  reason?: string;
};

type BookingConflictResponse = {
  error: string;
  code?: string;
};

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

export function assertAvailabilityReadResponse(value: unknown): value is AvailabilityReadResponse {
  if (!isObject(value) || !isObject(value.availability)) return false;
  if (typeof value.availability.vendor_id !== 'string' || typeof value.availability.timezone !== 'string') return false;
  if (!Array.isArray(value.availability.dates)) return false;
  return value.availability.dates.every((date) => {
    if (!isObject(date) || typeof date.date !== 'string' || typeof date.available !== 'boolean') return false;
    if (!Array.isArray(date.slots)) return false;
    return date.slots.every(
      (slot) => isObject(slot) && typeof slot.time === 'string' && typeof slot.available === 'boolean'
    );
  });
}

export function assertAvailabilityCheckResponse(value: unknown): value is AvailabilityCheckResponse {
  if (!isObject(value) || typeof value.available !== 'boolean') return false;
  return value.reason === undefined || typeof value.reason === 'string';
}

export function assertBookingConflictResponse(value: unknown): value is BookingConflictResponse {
  if (!isObject(value) || typeof value.error !== 'string') return false;
  return value.code === undefined || typeof value.code === 'string';
}

// Typed examples for compile-time checks.
const _availabilityExample: AvailabilityReadResponse = {
  availability: {
    vendor_id: 'v_1',
    timezone: 'America/New_York',
    dates: [
      {
        date: '2026-04-10',
        available: true,
        slots: [
          { time: '09:00', available: true },
          { time: '10:00', available: false },
        ],
      },
    ],
  },
};

const _availabilityCheckExample: AvailabilityCheckResponse = {
  available: false,
  reason: 'Selected slot is no longer available',
};

const _bookingConflictExample: BookingConflictResponse = {
  error: 'Selected slot is no longer available',
  code: 'SLOT_UNAVAILABLE',
};

export const availabilityContractTypeCheckSamples = {
  read: _availabilityExample,
  check: _availabilityCheckExample,
  conflict: _bookingConflictExample,
};
