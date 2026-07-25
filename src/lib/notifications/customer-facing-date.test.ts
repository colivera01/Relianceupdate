import { describe, expect, it } from 'vitest';
import {
  formatCustomerFacingServiceDate,
  formatCustomerFacingServiceDateTime,
} from '@/lib/notifications/customer-facing-date';

describe('formatCustomerFacingServiceDate', () => {
  it('keeps UTC-midnight date stable', () => {
    const out = formatCustomerFacingServiceDate({
      value: '2026-04-27T00:00:00.000Z',
      fallback: 'Recent booking',
    });
    expect(out).toBe('Apr 27, 2026');
  });

  it('formats date-only strings as intended calendar date', () => {
    const out = formatCustomerFacingServiceDate({
      value: '2026-04-27',
      fallback: 'Recent booking',
    });
    expect(out).toBe('Apr 27, 2026');
  });

  it('returns fallback for invalid date', () => {
    const out = formatCustomerFacingServiceDate({
      value: 'not-a-date',
      fallback: 'Recent booking',
    });
    expect(out).toBe('Recent booking');
  });
});

describe('formatCustomerFacingServiceDateTime', () => {
  it('formats an absolute timestamp in the service-order sender time zone', () => {
    const out = formatCustomerFacingServiceDateTime({
      value: '2026-07-25T01:59:13.000Z',
      timeZone: 'America/New_York',
    });

    expect(out).toMatch(/^Jul 24, 2026, 9:59 PM (EDT|GMT-4)$/);
  });

  it('returns a useful fallback for invalid date-time values', () => {
    expect(
      formatCustomerFacingServiceDateTime({
        value: 'not-a-date',
        fallback: 'Date/time unavailable',
      })
    ).toBe('Date/time unavailable');
  });
});
