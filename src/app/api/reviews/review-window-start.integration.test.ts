import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as reviewWindowStartPOST } from './window/start/route';
import { sendReviewInvitation } from '@/lib/review-notifications';
import { getUserIdFromRequest } from '@/lib/auth';

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const mediaSessionFindUnique = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const mediaAssetFindFirst = vi.fn();
  const reviewWindowFindFirst = vi.fn();
  const reviewWindowCreate = vi.fn();
  const reviewWindowUpdate = vi.fn();

  const prisma = {
    booking: { findUnique: bookingFindUnique },
    review: { findFirst: reviewFindFirst },
    mediaSession: { findUnique: mediaSessionFindUnique },
    consentRecord: { findFirst: consentRecordFindFirst },
    mediaAsset: { findFirst: mediaAssetFindFirst },
    reviewWindow: {
      findFirst: reviewWindowFindFirst,
      create: reviewWindowCreate,
      update: reviewWindowUpdate,
    },
  };

  return {
    prisma,
    bookingFindUnique,
    reviewFindFirst,
    mediaSessionFindUnique,
    consentRecordFindFirst,
    mediaAssetFindFirst,
    reviewWindowFindFirst,
    reviewWindowCreate,
    reviewWindowUpdate,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/review-notifications', () => ({
  sendReviewInvitation: vi.fn().mockResolvedValue({
    queued: false,
    reason: 'single_invitation_best_effort',
  }),
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn().mockResolvedValue('u1'),
}));

function postJson(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/reviews/window/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/reviews/window/start', () => {
  beforeEach(() => {
    hoisted.bookingFindUnique.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.mediaSessionFindUnique.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.mediaAssetFindFirst.mockReset();
    hoisted.reviewWindowFindFirst.mockReset();
    hoisted.reviewWindowCreate.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    vi.mocked(sendReviewInvitation).mockClear();
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.mediaAssetFindFirst.mockResolvedValue({ id: 'asset-visible' });
    hoisted.reviewFindFirst.mockResolvedValue(null);
  });

  it('returns 400 when bookingId is missing', async () => {
    const res = await reviewWindowStartPOST(
      postJson({ vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j.success).toBe(false);
    expect(String(j.error)).toContain('required');
  });

  it('returns 400 when vendorId is missing', async () => {
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when mediaSessionId is missing', async () => {
    const res = await reviewWindowStartPOST(postJson({ bookingId: 'b1', vendorId: 'v1' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when booking not found', async () => {
    hoisted.bookingFindUnique.mockResolvedValue(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'missing', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
    const j = await readJson(res);
    expect(j.error).toBe('Invalid booking/vendor pair');
    expect(hoisted.mediaSessionFindUnique).not.toHaveBeenCalled();
  });

  it('returns 409 when the booking already has a submitted review', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.reviewFindFirst.mockResolvedValue({ id: 'review-1' });

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );

    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('REVIEW_ALREADY_EXISTS');
    expect(hoisted.mediaSessionFindUnique).not.toHaveBeenCalled();
  });

  it('returns 409 when the booking is not completed yet', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'PENDING' });

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );

    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('BOOKING_NOT_COMPLETED');
    expect(hoisted.mediaSessionFindUnique).not.toHaveBeenCalled();
  });

  it('returns 409 when the selected media session is not the completed-stage service video', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'INTRO',
    });

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );

    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(j.code).toBe('REVIEW_REQUIRES_COMPLETED_STAGE_VIDEO');
    expect(hoisted.consentRecordFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when vendorId does not match booking', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v-correct', userId: 'u1', status: 'COMPLETED' });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v-wrong', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
    expect(hoisted.mediaSessionFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when media session missing', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
    const j = await readJson(res);
    expect(j.error).toBe('Invalid mediaSession for booking/vendor');
  });

  it('returns 404 when media session vendor does not match', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v-other',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when media session bookingId does not match', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b-other',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when video consent is not accepted', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(String(j.error)).toContain('consent');
    expect(hoisted.reviewWindowFindFirst).not.toHaveBeenCalled();
  });

  it('returns 403 when the completed-stage video is not customer-visible yet', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-1' });
    hoisted.mediaAssetFindFirst.mockResolvedValue(null);

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );

    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Selected media session is not customer-visible');
    expect(hoisted.reviewWindowFindFirst).not.toHaveBeenCalled();
  });

  it('returns 200 and does not schedule reminder when window already exists', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-1' });
    const existingWindow = {
      id: 'rw-existing',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: new Date(Date.now() + 3600_000),
    };
    hoisted.reviewWindowFindFirst.mockResolvedValue(existingWindow);

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.created).toBe(false);
    expect((j.reviewWindow as { id: string }).id).toBe('rw-existing');
    expect(hoisted.reviewWindowCreate).not.toHaveBeenCalled();
    expect(vi.mocked(sendReviewInvitation)).not.toHaveBeenCalled();
  });

  it('returns 200, creates availability, and sends one invitation when created', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-1' });
    hoisted.reviewWindowFindFirst.mockResolvedValue(null);
    const newWindow = {
      id: 'rw-new',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      openedAt: new Date(),
      expiresAt: new Date('9999-12-31T23:59:59.999Z'),
    };
    hoisted.reviewWindowCreate.mockResolvedValue(newWindow);

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.created).toBe(true);
    expect((j.reviewWindow as { id: string }).id).toBe('rw-new');
    expect(hoisted.reviewWindowCreate).toHaveBeenCalled();
    expect(vi.mocked(sendReviewInvitation)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendReviewInvitation)).toHaveBeenCalledWith({
      reviewWindowId: 'rw-new',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
    });
  });

  it('returns 200 when window create races with unique conflict (P2002)', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-1' });
    const fallbackWindow = {
      id: 'rw-race-existing',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
      status: 'active',
      expiresAt: new Date(Date.now() + 3600_000),
    };
    hoisted.reviewWindowFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fallbackWindow);
    hoisted.reviewWindowCreate.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed on the fields',
    });

    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.created).toBe(false);
    expect((j.reviewWindow as { id: string }).id).toBe('rw-race-existing');
    expect(vi.mocked(sendReviewInvitation)).not.toHaveBeenCalled();
  });

  it('returns 401 when requester user context is missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValueOnce(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when booking belongs to a different user', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u-other', status: 'COMPLETED' });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Forbidden: booking does not belong to this user');
  });

  it('returns 403 when selected media is not customer-visible', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.mediaAssetFindFirst.mockResolvedValue(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Selected media session is not customer-visible');
  });

  it('accepts booking-level consent across different media sessions', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1', status: 'COMPLETED' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms-completed',
      bookingId: 'b1',
      vendorId: 'v1',
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: 'COMPLETED',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-booking-level' });
    hoisted.reviewWindowFindFirst.mockResolvedValue({
      id: 'rw-completed',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms-completed',
      status: 'active',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms-completed' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
  });
});
