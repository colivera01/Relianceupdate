import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  vendorFindFirst: vi.fn(),
  serviceFindMany: vi.fn(),
  mediaAssetFindMany: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    vendor: { findFirst: h.vendorFindFirst },
    service: { findMany: h.serviceFindMany },
    mediaAsset: { findMany: h.mediaAssetFindMany },
  },
}));

vi.mock('@/lib/service-video-publication', () => ({
  resolveCanonicalPublicAssetIds: vi.fn(),
}));

vi.mock('@/lib/public-review-aggregates', () => ({
  getVendorReviewAggregatesForPublic: vi.fn(),
}));

vi.mock('@/lib/transient-db-errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/transient-db-errors')>();
  return {
    ...actual,
    withTransientDbRetry: vi.fn(<T>(operation: () => Promise<T>) => operation()),
  };
});

import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';
import { resolveCanonicalPublicAssetIds } from '@/lib/service-video-publication';
import { GET } from './route';

const vendor = {
  id: 'vendor-1',
  name: 'Electro LLC',
  businessName: 'Electro LLC',
  businessType: 'Electrical Services',
  category: 'Electrical',
  bio: 'Residential electrical service.',
  website: 'https://electro.example',
  city: 'Orlando',
  state: 'FL',
  serviceAreas: 'Orlando, FL, Winter Garden, FL',
  businessHoursJson: null,
  serviceTypes: 'Electrical Repair, Lighting Installation',
  specializations: 'electrical repair, Residential Rewiring',
  foundedYear: 2018,
};

const service = {
  id: 'service-1',
  name: 'Outlet Installation',
  description: 'Install or replace a residential outlet. Estimated duration: 60 minutes.',
  price: 125,
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
};

function finalAsset(input: {
  id: string;
  bookingId: string;
  mediaSessionId: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    mimeType: 'video/mp4',
    blobUrl: `https://cdn.example/${input.id}.mp4`,
    createdAt: new Date(input.createdAt),
    mediaSession: {
      id: input.mediaSessionId,
      bookingId: input.bookingId,
      serviceId: 'service-1',
      title: 'Completed outlet installation',
      vendorJobVideoStage: 'COMPLETED',
      sessionType: 'JOB_SERVICE_VIDEO',
    },
  };
}

async function getPublicVendor() {
  const response = await GET(
    new Request('http://localhost/api/vendors/vendor-1/public'),
    { params: Promise.resolve({ vendorId: 'vendor-1' }) },
  );
  return { response, json: await response.json() as Record<string, any> };
}

describe('GET /api/vendors/[vendorId]/public', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.vendorFindFirst.mockResolvedValue(vendor);
    h.serviceFindMany.mockResolvedValue([service]);
    h.mediaAssetFindMany.mockResolvedValue([]);
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue([]);
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(
      new Map([['vendor-1', { vendorId: 'vendor-1', rating: 4.9, reviewCount: 7 }]]),
    );
  });

  it('counts distinct completed bookings while deduplicating multiple assets from one booking', async () => {
    const assets = [
      finalAsset({
        id: 'asset-booking-a-newest',
        bookingId: 'booking-a',
        mediaSessionId: 'session-a-newest',
        createdAt: '2026-10-20T14:00:00.000Z',
      }),
      finalAsset({
        id: 'asset-booking-a-duplicate',
        bookingId: 'booking-a',
        mediaSessionId: 'session-a-duplicate',
        createdAt: '2026-10-19T14:00:00.000Z',
      }),
      finalAsset({
        id: 'asset-booking-b',
        bookingId: 'booking-b',
        mediaSessionId: 'session-b',
        createdAt: '2026-10-18T14:00:00.000Z',
      }),
    ];
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(assets.map((asset) => asset.id));
    h.mediaAssetFindMany.mockResolvedValue(assets);

    const { response, json } = await getPublicVendor();

    expect(response.status).toBe(200);
    expect(json.publicMedia).toHaveLength(2);
    expect(json.publicMedia.map((item: any) => item.mediaId)).toEqual([
      'asset-booking-a-newest',
      'asset-booking-b',
    ]);
    expect(json.publicProofSummary).toEqual({
      completedWorkCount: 2,
      publicMediaCount: 2,
      servicesWithPublicProof: 1,
    });
    expect(json.dataStatus.publicMedia).toBe('available');
  });

  it('preserves city and state pairs as complete service-area values', async () => {
    const { response, json } = await getPublicVendor();

    expect(response.status).toBe(200);
    expect(json.vendor.serviceAreas).toEqual(['Orlando, FL', 'Winter Garden, FL']);
    expect(json.vendor.specialties).toEqual([
      'Electrical Repair',
      'Lighting Installation',
      'Residential Rewiring',
    ]);
  });

  it('marks transient public-media enrichment failures instead of returning a genuine empty state', async () => {
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(['asset-public']);
    h.mediaAssetFindMany.mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' }),
    );

    const { response, json } = await getPublicVendor();

    expect(response.status).toBe(200);
    expect(json.publicMedia).toEqual([]);
    expect(json.publicProofSummary.completedWorkCount).toBe(0);
    expect(json.dataStatus.publicMedia).toBe('temporarily_unavailable');
    expect(json.dataStatus.reviewMetrics).toBe('available');
  });

  it('marks transient review aggregate failures instead of claiming the vendor is unrated', async () => {
    vi.mocked(getVendorReviewAggregatesForPublic).mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' }),
    );

    const { response, json } = await getPublicVendor();

    expect(response.status).toBe(200);
    expect(json.vendor.rating).toBeNull();
    expect(json.vendor.reviewCount).toBeNull();
    expect(json.dataStatus.publicMedia).toBe('available');
    expect(json.dataStatus.reviewMetrics).toBe('temporarily_unavailable');
  });
});
