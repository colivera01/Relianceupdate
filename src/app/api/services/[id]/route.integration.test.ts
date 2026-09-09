import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';
import { resolveCanonicalPublicAssetIds } from '@/lib/service-video-publication';

const hoisted = vi.hoisted(() => {
  const serviceFindFirst = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const reviewCount = vi.fn();

  return {
    prisma: {
      service: {
        findFirst: serviceFindFirst,
      },
      mediaAsset: {
        findMany: mediaAssetFindMany,
      },
      review: {
        count: reviewCount,
      },
    },
    serviceFindFirst,
    mediaAssetFindMany,
    reviewCount,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/public-review-aggregates', () => ({
  getVendorReviewAggregatesForPublic: vi.fn(),
}));

vi.mock('@/lib/service-video-publication', () => ({
  resolveCanonicalPublicAssetIds: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe('GET /api/services/[id]', () => {
  beforeEach(() => {
    hoisted.serviceFindFirst.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.reviewCount.mockReset();
    vi.mocked(getVendorReviewAggregatesForPublic).mockReset();
    vi.mocked(resolveCanonicalPublicAssetIds).mockReset();
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue([]);
  });

  it('returns one canonical featured video item and a public review count', async () => {
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue([
      'asset-featured',
      'asset-other-completed',
      'asset-intro',
      'asset-progress',
    ]);
    hoisted.serviceFindFirst.mockResolvedValue({
      id: 'svc-1',
      name: 'Metro Apartment Deep Clean',
      description: 'Detailed apartment and move-out cleaning with video-backed service updates.',
      price: 49.99,
      isPublished: true,
      vendor: {
        id: 'ven-1',
        name: 'Metro',
        businessName: 'Metro Home Care Pros',
        category: 'Cleaning',
        city: 'New York',
        state: 'NY',
        phone: '555-0199',
        email: 'vendor@example.test',
        isPubliclyListed: true,
        accountStatus: 'active',
        insuranceStatus: null,
        bondingStatus: null,
      },
    });

    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: 'asset-featured',
        mimeType: 'video/mp4',
        blobUrl: 'https://cdn.example/video.mp4',
        mediaSession: {
          vendorJobVideoStage: 'COMPLETED',
          sessionType: 'booking_stage_capture',
        },
      },
      {
        id: 'asset-other-completed',
        mimeType: 'video/mp4',
        blobUrl: 'https://cdn.example/video.mp4',
        mediaSession: {
          vendorJobVideoStage: 'COMPLETED',
          sessionType: 'booking_stage_capture',
        },
      },
      {
        id: 'asset-intro',
        mimeType: 'video/mp4',
        blobUrl: 'https://cdn.example/video.mp4',
        mediaSession: {
          vendorJobVideoStage: 'INTRO',
          sessionType: 'booking_stage_capture',
        },
      },
      {
        id: 'asset-progress',
        mimeType: 'video/mp4',
        blobUrl: 'https://cdn.example/progress.mp4',
        mediaSession: {
          vendorJobVideoStage: 'IN_PROGRESS',
          sessionType: 'booking_stage_capture',
        },
      },
    ]);

    hoisted.reviewCount.mockResolvedValue(5);
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(
      new Map([['ven-1', { vendorId: 'ven-1', rating: 4.8, reviewCount: 5 }]])
    );

    const res = await GET(
      new NextRequest('http://localhost/api/services/svc-1'),
      { params: Promise.resolve({ id: 'svc-1' }) }
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.service.publicReviewCount).toBe(5);
    expect(json.service.primaryProofVideoUrl).toBe('/api/public/media/asset-featured');
    expect(json.service.videoItems).toHaveLength(4);
    expect(json.service.videoItems.filter((item: any) => item.isPrimaryProofVideo)).toEqual([
      {
        createdAt: null,
        id: 'asset-featured',
        stageKey: 'COMPLETED',
        stageLabel: 'Final Result',
        url: '/api/public/media/asset-featured',
        isPrimaryProofVideo: true,
      },
    ]);
    expect(hoisted.reviewCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        demo: false,
        source: 'customer',
        bookingId: { not: null },
        comment: { not: null },
        moderationStatus: 'approved',
        visibilityStatus: 'public',
        user: { is: expect.objectContaining({ demo: false }) },
        vendor: expect.objectContaining({ demo: false }),
      }),
    });
  });

  it('returns a published public Service Offered when no canonical Public media exists', async () => {
    hoisted.serviceFindFirst.mockResolvedValue({
      id: 'svc-no-media',
      name: 'Breaker Replacement',
      description: 'Replace a faulty breaker.',
      price: 275,
      isPublished: true,
      vendor: {
        id: 'ven-1',
        name: 'Electro LLC',
        businessName: 'Electro LLC',
        category: 'Electrical',
        city: 'Orlando',
        state: 'FL',
        phone: null,
        email: null,
        isPubliclyListed: true,
        accountStatus: 'active',
        insuranceStatus: null,
        bondingStatus: null,
      },
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    hoisted.reviewCount.mockResolvedValue(0);
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(new Map());

    const res = await GET(
      new NextRequest('http://localhost/api/services/svc-no-media'),
      { params: Promise.resolve({ id: 'svc-no-media' }) },
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.service).toMatchObject({
      id: 'svc-no-media',
      images: [],
      videos: [],
      videoItems: [],
      primaryProofVideoUrl: null,
      hasPrimaryProofVideo: false,
      mediaCount: 0,
    });
    expect(hoisted.serviceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'svc-no-media',
          demo: false,
          vendor: expect.objectContaining({ demo: false }),
        }),
      }),
    );
  });

  it('returns 404 when the vendor is not publicly eligible', async () => {
    hoisted.serviceFindFirst.mockResolvedValue({
      id: 'svc-2',
      isPublished: true,
      vendor: {
        id: 'ven-2',
        isPubliclyListed: false,
        accountStatus: 'active',
      },
    });

    const res = await GET(
      new NextRequest('http://localhost/api/services/svc-2'),
      { params: Promise.resolve({ id: 'svc-2' }) }
    );

    expect(res.status).toBe(404);
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });
});
