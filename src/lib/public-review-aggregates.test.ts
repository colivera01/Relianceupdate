import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVendorReviewAggregatesForPublic } from './public-review-aggregates';

const groupBy = vi.hoisted(() => vi.fn());
vi.mock('@/server/db', () => ({ prisma: { review: { groupBy } } }));

describe('public Vendor rating aggregate', () => {
  beforeEach(() => groupBy.mockReset());

  it('counts verified corrected-contract stars without requiring public comment approval', async () => {
    groupBy.mockResolvedValue([
      { vendorId: 'vendor-1', rating: 5, _count: { _all: 1 } },
      { vendorId: 'vendor-1', rating: 4, _count: { _all: 1 } },
    ]);
    const result = await getVendorReviewAggregatesForPublic(['vendor-1']);
    expect(result.get('vendor-1')).toEqual({
      vendorId: 'vendor-1',
      rating: 4.5,
      reviewCount: 2,
      distribution: [
        { rating: 5, count: 1, percentage: 50 },
        { rating: 4, count: 1, percentage: 50 },
        { rating: 3, count: 0, percentage: 0 },
        { rating: 2, count: 0, percentage: 0 },
        { rating: 1, count: 0, percentage: 0 },
      ],
    });
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['vendorId', 'rating'],
      where: expect.objectContaining({
        vendorId: { in: ['vendor-1'] },
        OR: expect.arrayContaining([
          expect.objectContaining({ ratingValidityStatus: 'verified' }),
          expect.objectContaining({ moderationStatus: 'approved' }),
        ]),
      }),
    }));
  });
});
