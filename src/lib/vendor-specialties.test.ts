import { describe, expect, it } from 'vitest';
import { getVendorSpecialtyOptions } from './vendor-specialties';

describe('vendor specialty options', () => {
  it('uses electrical options for the stored Electrical category', () => {
    const options = getVendorSpecialtyOptions({ category: 'Electrical' });

    expect(options).toContain('Electrical Repair');
    expect(options).toContain('Lighting Installation');
    expect(options).not.toContain('House Cleaning');
    expect(options).not.toContain('Deep Cleaning');
  });

  it('falls back to the business type when the category has no configured options', () => {
    const options = getVendorSpecialtyOptions({
      category: 'Unmapped category',
      businessType: 'Electrical Services',
    });

    expect(options).toContain('Outlet Installation');
    expect(options).not.toContain('Commercial Cleaning');
  });

  it('keeps current selections visible alongside category suggestions', () => {
    const options = getVendorSpecialtyOptions({
      category: 'Electrical',
      selectedServiceTypes: [
        'Outlet Installation & Troubleshooting',
        'Breaker Replacement',
        'Residential Rewiring',
      ],
    });

    expect(options.slice(0, 3)).toEqual([
      'Outlet Installation & Troubleshooting',
      'Breaker Replacement',
      'Residential Rewiring',
    ]);
    expect(options).toContain('Electrical Repair');
  });

  it('resolves cleaning, pet-grooming, and nail aliases through the canonical registry', () => {
    expect(getVendorSpecialtyOptions({ category: 'Cleaning' })).toContain('Regular Cleaning');
    expect(getVendorSpecialtyOptions({ category: 'Pet Groomers' })).toContain('Full Grooming Service');
    expect(getVendorSpecialtyOptions({ category: 'Nail Salon' })).toContain('Gel Polish Service');
  });
});
