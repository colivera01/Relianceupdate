import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as bookingMediaGET } from './[id]/media/route';
import { POST as bookingCancelPOST } from './[id]/cancel/route';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  ARCHIVE_ACTIVE,
  MODERATION_APPROVED,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_PUBLIC,
} from '@/lib/media-visibility';

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const prisma = {
    booking: {
      findUnique: bookingFindUnique,
      update: bookingUpdate,
    },
    mediaAsset: {
      findMany: mediaAssetFindMany,
    },
  };
  return { prisma, bookingFindUnique, bookingUpdate, mediaAssetFindMany };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(),
}));

function mediaGetRequest(bookingId: string) {
  return new Request(`http://localhost/api/bookings/${encodeURIComponent(bookingId)}/media`, {
    method: 'GET',
  });
}

function cancelPostRequest(bookingId: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe('GET /api/bookings/[id]/media', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await bookingMediaGET(mediaGetRequest('book-1'), { params: Promise.resolve({ id: 'book-1' }) });
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(j.success).toBe(false);
    expect(j.error).toBe('Unauthorized');
  });

  it('returns 404 when booking not found', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue(null);
    const res = await bookingMediaGET(mediaGetRequest('missing'), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
    const j = await readJson(res);
    expect(j.error).toBe('Booking not found');
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it('returns 403 when booking belongs to another user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'book-1',
      userId: 'other-user',
      vendorId: 'v1',
      serviceId: 's1',
    });
    const res = await bookingMediaGET(mediaGetRequest('book-1'), { params: Promise.resolve({ id: 'book-1' }) });
    expect(res.status).toBe(403);
    const j = await readJson(res);
    expect(String(j.error)).toContain('Forbidden');
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it('passes approved/active + customer visibility filter to findMany', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'book-1',
      userId: 'u1',
      vendorId: 'v1',
      serviceId: 's1',
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    await bookingMediaGET(mediaGetRequest('book-1'), { params: Promise.resolve({ id: 'book-1' }) });
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.mediaAssetFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      deletedAt: null,
      moderationStatus: MODERATION_APPROVED,
      archiveStatus: ARCHIVE_ACTIVE,
      visibilityStatus: { in: [VISIBILITY_PUBLIC, VISIBILITY_CUSTOMER_ONLY] },
      mediaSession: { bookingId: 'book-1' },
    });
  });

  it('returns 200 with normalized shape and image/video split', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValue({
      id: 'book-1',
      userId: 'u1',
      vendorId: 'v1',
      serviceId: 's1',
    });
    const createdAt = new Date('2024-01-15T12:00:00.000Z');
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: 'asset-img',
        vendorId: 'v1',
        mediaSessionId: 'ms1',
        bytes: BigInt(100),
        mimeType: 'image/png',
        blobKey: 'key-img',
        blobUrl: 'https://blob/img',
        moderationStatus: 'approved',
        visibilityStatus: 'customer_only',
        archiveStatus: 'active',
        moderationReason: null,
        moderatedAt: null,
        createdAt,
        mediaSession: {
          title: 'Photo set',
          description: 'Before',
          bookingId: 'book-1',
          serviceId: 's1',
        },
      },
      {
        id: 'asset-vid',
        vendorId: 'v1',
        mediaSessionId: 'ms1',
        bytes: BigInt(5000),
        mimeType: 'video/mp4',
        blobKey: 'key-vid',
        blobUrl: 'https://blob/vid',
        moderationStatus: 'approved',
        visibilityStatus: 'public',
        archiveStatus: 'active',
        moderationReason: null,
        moderatedAt: null,
        createdAt,
        mediaSession: {
          title: 'Walkthrough',
          description: '',
          bookingId: 'book-1',
          serviceId: 's1',
        },
      },
    ]);

    const res = await bookingMediaGET(mediaGetRequest('book-1'), { params: Promise.resolve({ id: 'book-1' }) });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.bookingId).toBe('book-1');
    const assets = j.assets as Record<string, unknown>[];
    expect(assets).toHaveLength(2);
    expect(assets[0].id).toBe('asset-img');
    expect(assets[0].bytes).toBe('100');
    expect(assets[0].title).toBe('Photo set');
    expect(assets[0].visibilityStatus).toBe('customer_only');
    expect(assets[0].blobUrl).toBeNull();
    expect(String(assets[0].downloadUrl)).toContain('/api/bookings/book-1/media/asset-img/download');
    expect(assets[1].bytes).toBe('5000');
    expect(assets[1].mimeType).toBe('video/mp4');
    expect(assets[1].blobUrl).toBeNull();
    expect(String(assets[1].downloadUrl)).toContain('/api/bookings/book-1/media/asset-vid/download');
    const images = j.images as unknown[];
    const videos = j.videos as unknown[];
    expect(images).toHaveLength(1);
    expect(videos).toHaveLength(1);
    expect((images[0] as { id: string }).id).toBe('asset-img');
    expect((videos[0] as { id: string }).id).toBe('asset-vid');
  });
});

describe('POST /api/bookings/[id]/cancel', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await bookingCancelPOST(cancelPostRequest('book-1', {}), {
      params: Promise.resolve({ id: 'book-1' }),
    });
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(j.error).toBe('Unauthorized: customer context is required');
  });

  it('returns 404 when booking not found', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValueOnce(null);
    const res = await bookingCancelPOST(cancelPostRequest('missing', { reason: 'x' }), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when booking belongs to another user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.bookingFindUnique.mockResolvedValueOnce({
      id: 'book-1',
      userId: 'other',
      status: 'PENDING',
    });
    const res = await bookingCancelPOST(cancelPostRequest('book-1', {}), {
      params: Promise.resolve({ id: 'book-1' }),
    });
    expect(res.status).toBe(403);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it('returns 200, updates status, echoes cancellation_reason and refund_requested from body', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    const scheduled = new Date('2024-06-01T14:00:00.000Z');
    const createdAt = new Date('2024-05-01T10:00:00.000Z');
    const updatedAt = new Date('2024-06-02T10:00:00.000Z');
    const hydrated = {
      id: 'book-1',
      userId: 'u1',
      vendorId: 'v1',
      serviceId: 's1',
      title: 'Clean',
      clientName: 'Ann',
      amount: 120,
      status: 'CANCELED',
      scheduledFor: scheduled,
      date: scheduled,
      createdAt,
      updatedAt,
      customerMetadata: null,
      service: { id: 's1', name: 'Deep clean', description: 'd', price: 120 },
      vendor: {
        id: 'v1',
        name: 'Acme',
        businessName: 'Acme Co',
        phone: '555',
        email: 'v@v.com',
        city: 'Tampa',
        state: 'FL',
      },
    };
    hoisted.bookingFindUnique
      .mockResolvedValueOnce({ id: 'book-1', userId: 'u1', status: 'PENDING' })
      .mockResolvedValueOnce(hydrated);
    hoisted.bookingUpdate.mockResolvedValue(hydrated);

    const res = await bookingCancelPOST(
      cancelPostRequest('book-1', {
        reason: 'Schedule conflict',
        refund_requested: true,
      }),
      { params: Promise.resolve({ id: 'book-1' }) }
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.message).toBe('Booking cancelled successfully');
    expect(j.cancellation_reason).toBe('Schedule conflict');
    expect(j.refund_requested).toBe(true);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'CANCELED' },
    });
    const booking = j.booking as Record<string, unknown>;
    expect(booking.id).toBe('book-1');
    expect(booking.status).toBe('canceled');
    expect(booking.total_price).toBe(120);
  });

  it('parses body when reason and refund_requested are omitted', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    const scheduled = new Date('2024-06-01T14:00:00.000Z');
    const createdAt = new Date('2024-05-01T10:00:00.000Z');
    const updatedAt = new Date('2024-06-02T10:00:00.000Z');
    const hydrated = {
      id: 'book-2',
      userId: 'u1',
      vendorId: 'v1',
      serviceId: 's1',
      title: 'T',
      clientName: null,
      amount: 0,
      status: 'CANCELED',
      scheduledFor: scheduled,
      date: scheduled,
      createdAt,
      updatedAt,
      customerMetadata: null,
      service: { id: 's1', name: 'S', description: '', price: 50 },
      vendor: { id: 'v1', name: 'V', businessName: null, phone: null, email: null, city: null, state: null },
    };
    hoisted.bookingFindUnique
      .mockResolvedValueOnce({ id: 'book-2', userId: 'u1', status: 'CONFIRMED' })
      .mockResolvedValueOnce(hydrated);
    hoisted.bookingUpdate.mockResolvedValue({});

    const res = await bookingCancelPOST(cancelPostRequest('book-2', {}), {
      params: Promise.resolve({ id: 'book-2' }),
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.cancellation_reason).toBeUndefined();
    expect(j.refund_requested).toBeUndefined();
  });
});
