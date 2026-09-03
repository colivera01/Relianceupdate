import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './[reviewId]/moderate/route';

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/server/db', () => ({ prisma: { review: { findUnique: h.findUnique, update: h.update } } }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn(async () => ({ userId: 'admin-1' })) }));
vi.mock('@/lib/admin-audit', () => ({ createAdminAuditLog: h.audit }));

function request(action: string, moderationReason?: string) {
  return new Request('http://localhost/api/admin/reviews/review-1/moderate', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, moderationReason }),
  });
}

const existing = {
  id: 'review-1', vendorId: 'vendor-1', moderationStatus: 'pending_review', visibilityStatus: 'private',
  moderationReason: null, moderatedAt: null, moderatedByUserId: null, contractVersion: 2,
  ratingValidityStatus: 'verified', ratingInvalidationReason: null, ratingInvalidatedAt: null,
  ratingInvalidatedByUserId: null,
};

describe('Customer Review moderation contract', () => {
  beforeEach(() => {
    h.findUnique.mockReset().mockResolvedValue(existing);
    h.update.mockReset();
    h.audit.mockReset().mockResolvedValue(undefined);
  });

  it('rejects written content without invalidating verified stars', async () => {
    h.update.mockResolvedValue({ ...existing, moderationStatus: 'rejected', moderationReason: 'Personal information' });
    const response = await PATCH(request('reject', 'Personal information'), { params: Promise.resolve({ reviewId: 'review-1' }) });
    expect(response.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ moderationStatus: 'rejected', visibilityStatus: 'private' }),
    }));
    expect(h.update.mock.calls[0][0].data).not.toHaveProperty('ratingValidityStatus');
  });

  it('uses a separate auditable action to invalidate review evidence', async () => {
    h.update.mockResolvedValue({ ...existing, ratingValidityStatus: 'invalid', ratingInvalidationReason: 'Duplicate evidence' });
    const response = await PATCH(request('invalidate_review', 'Duplicate evidence'), { params: Promise.resolve({ reviewId: 'review-1' }) });
    expect(response.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ratingValidityStatus: 'invalid', ratingInvalidationReason: 'Duplicate evidence' }),
    }));
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'REVIEW_RATING_INVALIDATED' }));
  });

  it('does not reinterpret historical review evidence through the new invalidation contract', async () => {
    h.findUnique.mockResolvedValue({ ...existing, contractVersion: null, ratingValidityStatus: null });
    const response = await PATCH(request('invalidate_review', 'Duplicate evidence'), { params: Promise.resolve({ reviewId: 'review-1' }) });
    expect(response.status).toBe(409);
    expect(h.update).not.toHaveBeenCalled();
  });
});
