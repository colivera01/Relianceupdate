function parseDateOnlyString(value: string): Date | null {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDisplayDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = parseDateOnlyString(value);
  if (dateOnly) return dateOnly;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDisplayDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  const parsed = parseDisplayDate(value);
  return parsed ? parsed.toLocaleDateString("en-US", options) : null;
}

export function formatDisplayTime(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = match[2];
    if (Number.isFinite(hours)) {
      const suffix = hours >= 12 ? "PM" : "AM";
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      return `${displayHour}:${minutes} ${suffix}`;
    }
  }
  return trimmed;
}
