import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatDisplayTime, parseDisplayDate } from '@/lib/date-display';

describe('date-display helpers', () => {
  it('parses YYYY-MM-DD as a local calendar date without timezone shifting', () => {
    const parsed = parseDisplayDate('2026-05-30');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(30);
  });

  it('formats local date-only strings for customer-facing display', () => {
    expect(
      formatDisplayDate('2026-05-30', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    ).toBe('Saturday, May 30, 2026');
  });

  it('formats 24-hour booking times into readable 12-hour labels', () => {
    expect(formatDisplayTime('14:00:00')).toBe('2:00 PM');
    expect(formatDisplayTime('09:15')).toBe('9:15 AM');
  });
});
