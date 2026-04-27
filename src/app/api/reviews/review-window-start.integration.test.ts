import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as reviewWindowStartPOST } from './window/start/route';
import { scheduleReviewReminder } from '@/lib/review-notifications';
import { getUserIdFromRequest } from '@/lib/auth';

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const mediaSessionFindUnique = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const mediaAssetFindFirst = vi.fn();
  const reviewWindowFindFirst = vi.fn();
  const reviewWindowCreate = vi.fn();

  const prisma = {
    booking: { findUnique: bookingFindUnique },
    mediaSession: { findUnique: mediaSessionFindUnique },
    consentRecord: { findFirst: consentRecordFindFirst },
    mediaAsset: { findFirst: mediaAssetFindFirst },
    reviewWindow: {
      findFirst: reviewWindowFindFirst,
      create: reviewWindowCreate,
    },
  };

  return {
    prisma,
    bookingFindUnique,
    mediaSessionFindUnique,
    consentRecordFindFirst,
    mediaAssetFindFirst,
    reviewWindowFindFirst,
    reviewWindowCreate,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/review-notifications', () => ({
  scheduleReviewReminder: vi.fn().mockResolvedValue({
    queued: false,
    reason: 'no_background_scheduler',
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
    hoisted.mediaSessionFindUnique.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.mediaAssetFindFirst.mockReset();
    hoisted.reviewWindowFindFirst.mockReset();
    hoisted.reviewWindowCreate.mockReset();
    vi.mocked(scheduleReviewReminder).mockClear();
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.mediaAssetFindFirst.mockResolvedValue({ id: 'asset-visible' });
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

  it('returns 404 when vendorId does not match booking', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v-correct', userId: 'u1' });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v-wrong', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
    expect(hoisted.mediaSessionFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when media session missing', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
    const j = await readJson(res);
    expect(j.error).toBe('Invalid mediaSession for booking/vendor');
  });

  it('returns 404 when media session vendor does not match', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v-other',
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when media session bookingId does not match', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b-other',
      vendorId: 'v1',
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when video consent is not accepted', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
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

  it('returns 200 and does not schedule reminder when window already exists', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
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
    expect(vi.mocked(scheduleReviewReminder)).not.toHaveBeenCalled();
  });

  it('returns 200, creates window, and schedules reminder when created', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
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
      expiresAt: new Date(Date.now() + 72 * 3600_000),
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
    expect(vi.mocked(scheduleReviewReminder)).toHaveBeenCalledWith({
      reviewWindowId: 'rw-new',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms1',
    });
  });

  it('returns 200 when window create races with unique conflict (P2002)', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
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
    expect(vi.mocked(scheduleReviewReminder)).not.toHaveBeenCalled();
  });

  it('returns 401 when requester user context is missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValueOnce(null);
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when booking belongs to a different user', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u-other' });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms1' })
    );
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(j.error).toBe('Forbidden: booking does not belong to this user');
  });

  it('returns 403 when selected media is not customer-visible', async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms1',
      bookingId: 'b1',
      vendorId: 'v1',
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
    hoisted.bookingFindUnique.mockResolvedValue({ id: 'b1', vendorId: 'v1', userId: 'u1' });
    hoisted.mediaSessionFindUnique.mockResolvedValue({
      id: 'ms-during',
      bookingId: 'b1',
      vendorId: 'v1',
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: 'consent-booking-level' });
    hoisted.reviewWindowFindFirst.mockResolvedValue({
      id: 'rw-during',
      bookingId: 'b1',
      vendorId: 'v1',
      mediaSessionId: 'ms-during',
      status: 'active',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const res = await reviewWindowStartPOST(
      postJson({ bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'ms-during' })
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
  });
});
