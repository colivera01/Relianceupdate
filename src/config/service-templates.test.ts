import { describe, expect, it } from 'vitest';

import {
  CANONICAL_VENDOR_CATEGORY_LABELS,
  CANONICAL_VENDOR_CATEGORY_REGISTRY,
  CUSTOM_VENDOR_CATEGORY,
  SERVICE_TEMPLATES,
  VENDOR_REGISTRATION_CATEGORY_OPTIONS,
  canonicalizeVendorCategory,
  canonicalizeVendorRegistrationCategory,
  getServiceTemplatesForCategory,
  getVendorCategoryAcceptedValues,
} from './service-templates';

describe('canonical vendor category registry', () => {
  it('contains exactly the approved 26 prebuilt categories with templates and stable keys', () => {
    expect(CANONICAL_VENDOR_CATEGORY_REGISTRY).toHaveLength(26);
    expect(new Set(CANONICAL_VENDOR_CATEGORY_REGISTRY.map((category) => category.key)).size).toBe(26);
    expect(new Set(CANONICAL_VENDOR_CATEGORY_LABELS).size).toBe(26);
    expect(Object.keys(SERVICE_TEMPLATES)).toEqual(CANONICAL_VENDOR_CATEGORY_LABELS);
    expect(CANONICAL_VENDOR_CATEGORY_REGISTRY.every((category) => category.serviceTemplates.length > 0)).toBe(true);
    expect(CANONICAL_VENDOR_CATEGORY_REGISTRY.every((category) => category.registrationAvailable)).toBe(true);
    expect(CANONICAL_VENDOR_CATEGORY_REGISTRY.every((category) => category.specialtySuggestions)).toBe(true);
  });

  it('offers Other as a separate custom no-template registration path', () => {
    expect(VENDOR_REGISTRATION_CATEGORY_OPTIONS).toHaveLength(27);
    expect(VENDOR_REGISTRATION_CATEGORY_OPTIONS.at(-1)).toBe(CUSTOM_VENDOR_CATEGORY);
    expect(CANONICAL_VENDOR_CATEGORY_LABELS).not.toContain(CUSTOM_VENDOR_CATEGORY);
    expect(getServiceTemplatesForCategory(CUSTOM_VENDOR_CATEGORY)).toEqual([]);
  });

  it('removes retired duplicate and out-of-catalog entries from registration', () => {
    expect(VENDOR_REGISTRATION_CATEGORY_OPTIONS).not.toEqual(
      expect.arrayContaining(['Nail Salon', 'Pet Groomers', 'Bakery', 'Restaurant Owners', 'Cleaning']),
    );
  });

  it('resolves approved historical aliases without treating Home services as Home cleaners', () => {
    expect(canonicalizeVendorCategory('Electrical')).toBe('Electrician');
    expect(canonicalizeVendorCategory('Electrical Services')).toBe('Electrician');
    expect(canonicalizeVendorCategory('Electrical service')).toBe('Electrician');
    expect(canonicalizeVendorCategory('Cleaning')).toBe('Home cleaners');
    expect(canonicalizeVendorCategory('Pet Groomers')).toBe('Pet Grooming');
    expect(canonicalizeVendorCategory('Nail Salon')).toBe('Hair/Nail Salon');
    expect(canonicalizeVendorCategory('Home services')).toBeNull();
    expect(canonicalizeVendorRegistrationCategory('Other')).toBe('Other');
  });

  it('preserves the five approved Nail Salon templates in Hair/Nail Salon', () => {
    const names = getServiceTemplatesForCategory('Hair/Nail Salon').map((template) => template.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Gel Polish Service',
        'Acrylic Nails',
        'Nail Repair',
        'Dip Powder Nails',
        'Natural Nail Care',
      ]),
    );
    expect(getServiceTemplatesForCategory('Nail Salon')).toEqual(
      getServiceTemplatesForCategory('Hair/Nail Salon'),
    );
  });

  it('returns canonical and historical values for read-time filtering', () => {
    expect(getVendorCategoryAcceptedValues('Electrician')).toEqual([
      'Electrician',
      'Electrical',
      'Electrical Services',
      'Electrical service',
    ]);
  });
});
