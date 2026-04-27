import { describe, expect, it } from 'vitest';
import { formatCustomerFacingServiceDate } from '@/lib/notifications/customer-facing-date';

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
