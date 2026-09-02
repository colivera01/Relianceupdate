import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createReviewPOST } from './create/route';
import { POST as expireReviewPOST } from './window/expire/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { loadAuthorizedPrivateProof } from '@/lib/service-video-evidence';

const futureExpires = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const hoisted = vi.hoisted(() => {
  const reviewWindowFindUnique = vi.fn();
  const reviewWindowUpdate = vi.fn();
  const reviewWindowUpdateMany = vi.fn();
  const bookingFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const reviewCreate = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const employeeCustomerRatingCreate = vi.fn();
  const reviewCount = vi.fn();
  const mediaAssetFindFirst = vi.fn();
  const $transaction = vi.fn();

  const prisma = {
    reviewWindow: {
      findUnique: reviewWindowFindUnique,
      update: reviewWindowUpdate,
      updateMany: reviewWindowUpdateMany,
    },
    booking: { findUnique: bookingFindUnique },
    vendorMembership: { findFirst: vendorMembershipFindFirst },
    review: { findFirst: reviewFindFirst, count: reviewCount },
    mediaAsset: { findFirst: mediaAssetFindFirst },
    reviewPromptEvent: { create: reviewPromptEventCreate },
    employeeCustomerRatingEvidence: { create: employeeCustomerRatingCreate },
    $transaction,
  };

  return {
    prisma,
    reviewWindowFindUnique,
    reviewWindowUpdate,
    reviewWindowUpdateMany,
    bookingFindUnique,
    reviewFindFirst,
    vendorMembershipFindFirst,
    reviewCreate,
    reviewPromptEventCreate,
    employeeCustomerRatingCreate,
    reviewCount,
    mediaAssetFindFirst,
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

vi.mock('@/lib/email-verification-enforcement', () => ({
  requireVerifiedEmailForAction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/service-video-evidence', () => ({
  loadAuthorizedPrivateProof: vi.fn(),
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
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.$transaction.mockReset();
    hoisted.reviewCreate.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    hoisted.reviewWindowUpdateMany.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    hoisted.employeeCustomerRatingCreate.mockReset();
    hoisted.mediaAssetFindFirst.mockReset();
    hoisted.mediaAssetFindFirst.mockResolvedValue({ id: 'asset-visible' });
    vi.mocked(createAdminAuditLog).mockClear();
    vi.mocked(loadAuthorizedPrivateProof).mockResolvedValue({
      stages: [{ stage: 'COMPLETED', mediaSessionId: 'ms1' }],
    } as any);
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
      status: 'COMPLETED',
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

  it('does not allow a review for an incomplete work record', async () => {
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
      status: 'IN_PROGRESS',
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
      })
    );

    expect(res.status).toBe(409);
    expect((await readJson(res)).code).toBe('BOOKING_NOT_COMPLETED');
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
  });

  it('requires an active exact Private Proof at submission time', async () => {
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
      status: 'COMPLETED',
    });
    vi.mocked(loadAuthorizedPrivateProof).mockResolvedValue(null);

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
      })
    );

    expect(res.status).toBe(409);
    expect((await readJson(res)).code).toBe('REVIEW_PRIVATE_PROOF_REQUIRED');
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
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

  it('allows an eligible customer to review more than 72 hours after availability began', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'b1',
      userId: 'customer-a',
      vendorId: 'v1',
      status: 'COMPLETED',
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);

    const createdReview = {
      id: 'rev-new',
      userId: 'customer-a',
      vendorId: 'v1',
      bookingId: 'b1',
      rating: 5,
      moderationStatus: 'pending_review',
      visibilityStatus: 'private',
    };
    hoisted.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: { create: hoisted.reviewCreate },
        reviewWindow: {
          update: hoisted.reviewWindowUpdate,
          updateMany: hoisted.reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: hoisted.reviewPromptEventCreate },
        employeeCustomerRatingEvidence: { create: hoisted.employeeCustomerRatingCreate },
      };
      hoisted.reviewCreate.mockResolvedValue(createdReview);
      hoisted.reviewWindowUpdate.mockResolvedValue({ id: 'rw1', status: 'submitted' });
      hoisted.reviewWindowUpdateMany.mockResolvedValue({ count: 0 });
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
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moderationStatus: 'pending_review',
          visibilityStatus: 'private',
        }),
      })
    );
    expect(vi.mocked(createAdminAuditLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'review_capture_submitted',
        entityType: 'review',
        entityId: 'rev-new',
        actorUserId: 'customer-a',
      })
    );
    expect(hoisted.reviewWindowUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: 'b1',
          status: 'active',
        }),
        data: expect.objectContaining({
          status: 'closed',
        }),
      })
    );
  });

  it('creates a separate employee rating bound to the primary assigned employee', async () => {
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
      status: 'COMPLETED',
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ['membership-2'],
        vendor_job_assigned_employees: ['Tech Two'],
        vendor_job_primary_membership_id: 'membership-2',
        vendor_job_primary_employee: 'Tech Two',
      }),
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);
    hoisted.vendorMembershipFindFirst.mockResolvedValue({
      userId: 'employee-user-1',
      user: { name: 'Tech Two', email: 'tech2@example.com' },
    });

    hoisted.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: { create: hoisted.reviewCreate },
        reviewWindow: {
          update: hoisted.reviewWindowUpdate,
          updateMany: hoisted.reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: hoisted.reviewPromptEventCreate },
        employeeCustomerRatingEvidence: { create: hoisted.employeeCustomerRatingCreate },
      };
      hoisted.reviewCreate.mockResolvedValue({ id: 'rev-attr' });
      hoisted.reviewWindowUpdate.mockResolvedValue({ id: 'rw1', status: 'submitted' });
      hoisted.reviewWindowUpdateMany.mockResolvedValue({ count: 0 });
      hoisted.reviewPromptEventCreate.mockResolvedValue({});
      hoisted.employeeCustomerRatingCreate.mockResolvedValue({ id: 'employee-rating-1', rating: 3 });
      return fn(tx);
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'video_overlay',
        employeeRating: 3,
      })
    );
    expect(res.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedMembershipId: 'membership-2',
          assignedEmployeeName: 'Tech Two',
          assignedUserId: 'employee-user-1',
          attributionVersion: 3,
        }),
      })
    );
    expect(hoisted.employeeCustomerRatingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewId: 'rev-attr',
          bookingId: 'b1',
          vendorId: 'v1',
          customerUserId: 'customer-a',
          employeeMembershipId: 'membership-2',
          employeeUserId: 'employee-user-1',
          employeeNameSnapshot: 'Tech Two',
          rating: 3,
        }),
      })
    );
  });

  it('creates vendor-level review with null employee attribution when booking has no assignment', async () => {
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
      status: 'COMPLETED',
      customerMetadata: JSON.stringify({}),
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);

    hoisted.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: { create: hoisted.reviewCreate },
        reviewWindow: {
          update: hoisted.reviewWindowUpdate,
          updateMany: hoisted.reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: hoisted.reviewPromptEventCreate },
        employeeCustomerRatingEvidence: { create: hoisted.employeeCustomerRatingCreate },
      };
      hoisted.reviewCreate.mockResolvedValue({ id: 'rev-no-assignee' });
      hoisted.reviewWindowUpdate.mockResolvedValue({ id: 'rw1', status: 'submitted' });
      hoisted.reviewWindowUpdateMany.mockResolvedValue({ count: 0 });
      hoisted.reviewPromptEventCreate.mockResolvedValue({});
      return fn(tx);
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 4,
        submittedVia: 'manual',
      })
    );
    expect(res.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedMembershipId: null,
          assignedEmployeeName: null,
          assignedUserId: null,
          attributionVersion: 3,
        }),
      })
    );
  });

  it('returns 409 REVIEW_ALREADY_EXISTS when DB unique constraint rejects duplicate booking review', async () => {
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
      status: 'COMPLETED',
      customerMetadata: null,
    });
    hoisted.reviewFindFirst.mockResolvedValue(null);
    hoisted.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: { create: hoisted.reviewCreate },
        reviewWindow: {
          update: hoisted.reviewWindowUpdate,
          updateMany: hoisted.reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: hoisted.reviewPromptEventCreate },
        employeeCustomerRatingEvidence: { create: hoisted.employeeCustomerRatingCreate },
      };
      hoisted.reviewCreate.mockRejectedValue({ code: 'P2002', message: 'Unique constraint failed' });
      return fn(tx);
    });

    const res = await createReviewPOST(
      jsonRequest('http://localhost/api/reviews/create', {
        reviewWindowId: 'rw1',
        bookingId: 'b1',
        vendorId: 'v1',
        rating: 5,
        submittedVia: 'manual',
      })
    );
    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('REVIEW_ALREADY_EXISTS');
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
    hoisted.reviewCreate.mockReset();
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
    expect(j.error).toBe('Only the booking customer can manage this review opportunity');
    expect(hoisted.reviewWindowUpdate).not.toHaveBeenCalled();
  });

  it('does not turn a historical non-active record into a review', async () => {
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
    expect(String(j.message)).toContain('do not expire');
    expect(j.reviewOpportunityStillAvailable).toBe(true);
    expect(j.reviewCreated).toBe(false);
    expect(hoisted.reviewWindowUpdate).not.toHaveBeenCalled();
  });

  it('does not close an active review opportunity or create a review', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-a');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
    });
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', userId: 'customer-a' });
    const res = await expireReviewPOST(
      jsonRequest('http://localhost/api/reviews/window/expire', { reviewWindowId: 'rw1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect((j.reviewWindow as { status: string }).status).toBe('active');
    expect(j.reviewOpportunityStillAvailable).toBe(true);
    expect(j.reviewCreated).toBe(false);
    expect(hoisted.reviewWindowUpdate).not.toHaveBeenCalled();
    expect(hoisted.reviewPromptEventCreate).not.toHaveBeenCalled();
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
  });
});
