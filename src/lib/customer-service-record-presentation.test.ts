import { describe, expect, it } from 'vitest';
import { hasCustomerSchedulePassed } from '@/lib/customer-service-record-presentation';

describe('customer Service Record presentation', () => {
  const now = new Date('2026-09-05T12:00:00.000Z');

  it('flags a past scheduled time without changing lifecycle evidence', () => {
    expect(hasCustomerSchedulePassed('2026-09-04', '10:00:00', now)).toBe(true);
    expect(hasCustomerSchedulePassed('2026-09-06', '10:00:00', now)).toBe(false);
  });

  it('does not mark a date-only record past until that calendar day ends', () => {
    expect(hasCustomerSchedulePassed('2026-09-05', null, now)).toBe(false);
    expect(hasCustomerSchedulePassed('2026-09-04', null, now)).toBe(true);
  });

  it('fails safely for missing or invalid dates', () => {
    expect(hasCustomerSchedulePassed(null, null, now)).toBe(false);
    expect(hasCustomerSchedulePassed('not-a-date', null, now)).toBe(false);
  });
});
