import { describe, expect, it } from 'vitest';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';

describe('resolveCustomerFacingServiceLabel', () => {
  it('prefers a clean booking title when available', () => {
    expect(
      resolveCustomerFacingServiceLabel({
        bookingTitle: 'Completed Home Cleaning Walkthrough',
        serviceName: 'General Service Job',
        vendorName: 'Metro Home Care Pros',
      })
    ).toBe('Completed Home Cleaning Walkthrough');
  });

  it('falls back from internal booking labels to cleaned service names', () => {
    expect(
      resolveCustomerFacingServiceLabel({
        bookingTitle: 'Fresh recount validation 20260528000304',
        serviceName: 'General Service Job',
        vendorName: 'Metro Home Care Pros',
      })
    ).toBe('Completed Home Service Visit');
  });

  it('uses the sparkle-specific fallback for internal Sparkle records', () => {
    expect(
      resolveCustomerFacingServiceLabel({
        serviceName: 'Fresh recount validation 20260528000304',
        vendorName: 'Sparkle Clean Pro',
      })
    ).toBe('Sparkle Home Cleaning Visit');
  });
});
