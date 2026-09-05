export function hasCustomerSchedulePassed(
  bookingDate: string | null | undefined,
  bookingTime?: string | null,
  now = new Date()
): boolean {
  const value = String(bookingDate || '').trim();
  if (!value) return false;

  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (dateOnly) {
    const time = /^\d{2}:\d{2}(?::\d{2})?$/.test(String(bookingTime || '').trim())
      ? String(bookingTime).trim()
      : '23:59:59';
    const scheduled = new Date(`${dateOnly}T${time}`);
    return !Number.isNaN(scheduled.getTime()) && scheduled.getTime() < now.getTime();
  }

  const scheduled = new Date(value);
  return !Number.isNaN(scheduled.getTime()) && scheduled.getTime() < now.getTime();
}
