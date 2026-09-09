import { describe, expect, it } from 'vitest';

import {
  buildDiscoverPromotionCategoryFilter,
  buildDiscoverServiceCategoryFilter,
} from '@/lib/discover-category-filter';

describe('Discover category filters', () => {
  const electricalValues = [
    'Electrician',
    'Electrical',
    'Electrical Services',
    'Electrical service',
  ];

  it('matches Electrician browse requests against stored Electrical values', () => {
    expect(buildDiscoverServiceCategoryFilter('Electrician')).toEqual({
      OR: [
        { vendor: { category: { in: electricalValues } } },
        { vendor: { businessType: { in: electricalValues } } },
      ],
    });
  });

  it('keeps untargeted promotions eligible while applying category aliases', () => {
    expect(buildDiscoverPromotionCategoryFilter('Electrical')).toEqual({
      OR: [
        { targetCategory: null },
        { targetCategory: '' },
        { targetCategory: { in: electricalValues } },
        { service: { vendor: { category: { in: electricalValues } } } },
        { service: { vendor: { businessType: { in: electricalValues } } } },
      ],
    });
  });
});
