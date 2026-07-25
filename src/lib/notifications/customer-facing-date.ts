type CustomerFacingDateInput = {
  value: Date | string | null | undefined;
  timeZone?: string | null | undefined;
  locale?: string;
  fallback?: string;
};

type CustomerFacingDateTimeInput = CustomerFacingDateInput & {
  timeZoneName?: 'short' | 'long';
};

function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function formatCustomerFacingServiceDate(input: CustomerFacingDateInput): string {
  const fallback = input.fallback || 'Recent booking';
  if (!input.value) return fallback;

  const locale = input.locale || 'en-US';
  const timeZone = String(input.timeZone || '').trim() || undefined;

  if (typeof input.value === 'string') {
    const raw = input.value.trim();
    if (!raw) return fallback;
    if (isDateOnlyString(raw)) {
      const [y, m, d] = raw.split('-').map((part) => Number(part));
      const utcDate = new Date(Date.UTC(y, m - 1, d));
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(utcDate);
    }
  }

  const date = input.value instanceof Date ? input.value : new Date(String(input.value));
  if (Number.isNaN(date.getTime())) return fallback;

  // For "service day" timestamps stored as UTC midnight, preserve UTC calendar date.
  if (isUtcMidnight(date)) {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatCustomerFacingServiceDateTime(
  input: CustomerFacingDateTimeInput
): string {
  const fallback = input.fallback || 'Date/time not set yet';
  if (!input.value) return fallback;

  const date =
    input.value instanceof Date ? input.value : new Date(String(input.value));
  if (Number.isNaN(date.getTime())) return fallback;

  const locale = input.locale || 'en-US';
  const timeZone = String(input.timeZone || '').trim() || undefined;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
    timeZoneName: input.timeZoneName || 'short',
  }).format(date);
}
