export function resolveBookingSchedule(input: {
  scheduledFor?: unknown;
  bookingDate?: unknown;
  bookingTime?: unknown;
}): Date {
  const absolute = String(input.scheduledFor || "").trim();
  if (absolute) {
    const parsed = new Date(absolute);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const date = String(input.bookingDate || "").trim();
  const time = String(input.bookingTime || "").trim();
  if (date && time) {
    const parsed = new Date(`${date}T${time}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
