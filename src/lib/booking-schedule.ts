export const DEFAULT_SERVICE_TIME_ZONE = "America/New_York";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function validTimeZone(value: unknown): string {
  const candidate = String(value || "").trim() || DEFAULT_SERVICE_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_SERVICE_TIME_ZONE;
  }
}

function partsInTimeZone(value: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
    second: numberPart("second"),
  };
}

function timeZoneOffsetMs(value: Date, timeZone: string): number {
  const parts = partsInTimeZone(value, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(value.getTime() / 1000) * 1000;
}

export function zonedDateTimeToUtc(input: {
  date: unknown;
  time: unknown;
  timeZone?: unknown;
}): Date | null {
  const date = String(input.date || "").trim();
  const time = String(input.time || "").trim().slice(0, 5);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const timeZone = validTimeZone(input.timeZone);
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instantMs = targetWallClock;
  for (let index = 0; index < 3; index += 1) {
    instantMs = targetWallClock - timeZoneOffsetMs(new Date(instantMs), timeZone);
  }
  const resolved = new Date(instantMs);
  const roundTrip = partsInTimeZone(resolved, timeZone);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    return null;
  }
  return resolved;
}

export function dateAndTimeInZone(value: Date, timeZone?: unknown): {
  date: string;
  time: string;
} {
  const parts = partsInTimeZone(value, validTimeZone(timeZone));
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

export function resolveBookingSchedule(input: {
  scheduledFor?: unknown;
  bookingDate?: unknown;
  bookingTime?: unknown;
  timeZone?: unknown;
}): Date | null {
  const absolute = String(input.scheduledFor || "").trim();
  if (absolute) {
    const parsed = new Date(absolute);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return zonedDateTimeToUtc({
    date: input.bookingDate,
    time: input.bookingTime,
    timeZone: input.timeZone,
  });
}
