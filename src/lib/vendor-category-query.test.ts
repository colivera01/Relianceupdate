import { describe, expect, it } from 'vitest';

import {
  buildPromotionCategoryFilter,
  buildServiceVendorCategoryFilter,
  buildVendorCategoryFilter,
} from './vendor-category-query';

describe('category query aliases', () => {
  const electricianValues = [
    'Electrician',
    'Electrical',
    'Electrical Services',
    'Electrical service',
  ];

  it('builds Search-compatible vendor filters for canonical labels and aliases', () => {
    expect(buildVendorCategoryFilter('Electrician')).toEqual({
      OR: [
        { category: { in: electricianValues } },
        { businessType: { in: electricianValues } },
      ],
    });
  });

  it('builds Discover and public service filters against stored aliases', () => {
    expect(buildServiceVendorCategoryFilter('Electrical')).toEqual({
      OR: [
        { vendor: { category: { in: electricianValues } } },
        { vendor: { businessType: { in: electricianValues } } },
      ],
    });
  });

  it('builds promotion filters against canonical and alias values', () => {
    expect(buildPromotionCategoryFilter('Electrician')).toEqual({
      OR: [
        { targetCategory: { in: electricianValues } },
        { service: { vendor: { category: { in: electricianValues } } } },
        { service: { vendor: { businessType: { in: electricianValues } } } },
      ],
    });
  });
});
