import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVendorReviewAggregatesForPublic } from './public-review-aggregates';

const groupBy = vi.hoisted(() => vi.fn());
vi.mock('@/server/db', () => ({ prisma: { review: { groupBy } } }));

describe('public Vendor rating aggregate', () => {
  beforeEach(() => groupBy.mockReset());

  it('counts verified corrected-contract stars without requiring public comment approval', async () => {
    groupBy.mockResolvedValue([{ vendorId: 'vendor-1', _avg: { rating: 4.5 }, _count: { _all: 2 } }]);
    const result = await getVendorReviewAggregatesForPublic(['vendor-1']);
    expect(result.get('vendor-1')).toEqual({ vendorId: 'vendor-1', rating: 4.5, reviewCount: 2 });
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
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
