import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createReviewPOST } from './create/route';
import { POST as expireReviewPOST } from './window/expire/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { notifyReviewWindowClosedWithoutSubmission } from '@/lib/review-notifications';

const futureExpires = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const hoisted = vi.hoisted(() => {
  const reviewWindowFindUnique = vi.fn();
  const reviewWindowUpdate = vi.fn();
  const bookingFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const reviewCreate = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const reviewCount = vi.fn();
  const $transaction = vi.fn();

  const prisma = {
    reviewWindow: {
      findUnique: reviewWindowFindUnique,
      update: reviewWindowUpdate,
    },
    booking: { findUnique: bookingFindUnique },
    review: { findFirst: reviewFindFirst, count: reviewCount },
    reviewPromptEvent: { create: reviewPromptEventCreate },
    $transaction,
  };

  return {
    prisma,
    reviewWindowFindUnique,
    reviewWindowUpdate,
    bookingFindUnique,
    reviewFindFirst,
    reviewCreate,
    reviewPromptEventCreate,
    reviewCount,
    $transaction,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/admin-audit', () => ({
  createAdminAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/review-notifications', () => ({
  notifyReviewWindowClosedWithoutSubmission: vi.fn().mockResolvedValue({
    sent: false,
    reason: 'notification_partial_or_skipped',
    context: {},
    delivery: null,
    loadError: null,
  }),
}));

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/reviews/create', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.reviewWindowFindUnique.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.$transaction.mockReset();
    hoisted.reviewCreate.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    vi.mocked(createAdminAuditLog).mockClear();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
      })
    );
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(j.success).toBe(false);
    expect(j.error).toBe('Authentication required');
  });

  it('returns 403 when booking owner mismatches caller', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: futureExpires(),
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'b1',
      userId: 'customer-b',
      vendorId: 'v1',
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 4,
        submittedVia: 'manual',
      })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Only the booking customer can submit review');
    expect(hoisted.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 REVIEW_WINDOW_CONTEXT_MISMATCH when window booking/vendor do not match body', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b-real',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: futureExpires(),
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b-wrong',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
      })
    );
    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('REVIEW_WINDOW_CONTEXT_MISMATCH');
    expect(hoisted.bookingFindUnique).not.toHaveBeenCalled();
  });

  it('returns 409 REVIEW_WINDOW_MEDIA_MISMATCH when optional mediaSessionId conflicts', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms-window',
      status: 'active',
      expiresAt: futureExpires(),
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
        mediaSessionId: 'ms-body-other',
      })
    );
    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('REVIEW_WINDOW_MEDIA_MISMATCH');
  });

  it('returns 200 success path with valid ownership and matching active window', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: futureExpires(),
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'b1',
      userId: 'customer-a',
      vendorId: 'v1',
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);

    const createdReview = {
      id: 'rev-new',
      userId: 'customer-a',
      vendorId: 'v1',
      bookingId: 'b1',
      rating: 5,
    };
    hoisted.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: { create: hoisted.reviewCreate },
        reviewWindow: { update: hoisted.reviewWindowUpdate },
        reviewPromptEvent: { create: hoisted.reviewPromptEventCreate },
      };
      hoisted.reviewCreate.mockResolvedValue(createdReview);
      hoisted.reviewWindowUpdate.mockResolvedValue({ id: 'rw1', status: 'submitted' });
      hoisted.reviewPromptEventCreate.mockResolvedValue({});
      return fn(tx);
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'video_overlay',
      })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect((j.review as { id: string }).id).toBe('rev-new');
    expect(j.links).toEqual({
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
    });
    expect(hoisted.reviewCreate).toHaveBeenCalled();
    expect(vi.mocked(createAdminAuditLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'review_capture_submitted',
        entityType: 'review',
        entityId: 'rev-new',
        actorUserId: 'customer-a',
      })
    );
  });
});

describe('POST /api/reviews/window/expire', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.reviewWindowFindUnique.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    hoisted.reviewCount.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    vi.mocked(notifyReviewWindowClosedWithoutSubmission).mockClear();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await expireReviewPOST(
      jsonRequest('http://localhost/api/reviews/window/expire', { reviewWindowId: 'rw1' })
    );
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(j.error).toBe('Authentication required');
  });

  it('returns 403 when booking owner mismatches caller', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
    });
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'customer-b' });

    const res = await expireReviewPOST(
      jsonRequest('http://localhost/api/reviews/window/expire', { reviewWindowId: 'rw1' })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Only the booking customer can expire this review window');
    expect(hoisted.reviewWindowUpdate).not.toHaveBeenCalled();
  });

  it('returns 200 authorized path when window is already non-active', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      status: 'expired',
      closedAt: new Date(),
    });
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'customer-a' });

    const res = await expireReviewPOST(
      jsonRequest('http://localhost/api/reviews/window/expire', { reviewWindowId: 'rw1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(String(j.message)).toContain('Window already expired');
    expect(hoisted.reviewWindowUpdate).not.toHaveBeenCalled();
    expect(vi.mocked(notifyReviewWindowClosedWithoutSubmission)).not.toHaveBeenCalled();
  });

  it('returns 200 success path when window is active', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
    });
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'customer-a' });
    hoisted.reviewWindowUpdate.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'expired',
      closedAt: new Date(),
    });
    hoisted.reviewCount.mockResolvedValue(0);
    hoisted.reviewPromptEventCreate.mockResolvedValue({});

    const res = await expireReviewPOST(
      jsonRequest('http://localhost/api/reviews/window/expire', { reviewWindowId: 'rw1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect((j.reviewWindow as { status: string }).status).toBe('expired');
    expect(hoisted.reviewWindowUpdate).toHaveBeenCalled();
    expect(hoisted.reviewPromptEventCreate).toHaveBeenCalled();
    expect(vi.mocked(notifyReviewWindowClosedWithoutSubmission)).toHaveBeenCalled();
  });
});
