import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  serviceCount: vi.fn(),
  serviceFindMany: vi.fn(),
  mediaAssetFindMany: vi.fn(),
  promotionCampaignFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    service: {
      count: h.serviceCount,
      findMany: h.serviceFindMany,
    },
    mediaAsset: { findMany: h.mediaAssetFindMany },
    promotionCampaign: { findMany: h.promotionCampaignFindMany },
  },
}));

vi.mock("@/lib/service-video-publication", () => ({
  resolveCanonicalPublicAssetIds: vi.fn(),
}));

vi.mock("@/lib/public-review-aggregates", () => ({
  getVendorReviewAggregatesForPublic: vi.fn(),
}));

vi.mock("@/lib/transient-db-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/transient-db-errors")>();
  return {
    ...actual,
    withTransientDbRetry: vi.fn(<T>(operation: () => Promise<T>) => operation()),
  };
});

import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";
import { GET } from "./route";

const service = {
  id: "service-1",
  name: "Breaker Replacement",
  description: "Replace a residential breaker.",
  price: 125,
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  vendorId: "vendor-1",
  isPublished: true,
  vendor: {
    id: "vendor-1",
    name: "Electro LLC",
    businessName: "Electro LLC",
    businessType: "Electrical Services",
    category: "Electrical",
    city: "Winter Springs",
    state: "FL",
    latitude: null,
    longitude: null,
    geocodedAt: null,
    businessHoursJson: null,
    isPubliclyListed: true,
    accountStatus: "active",
  },
};

function legacyStageAsset(stage: "INTRO" | "IN_PROGRESS" | "COMPLETED") {
  return {
    id: `asset-${stage.toLowerCase()}`,
    mimeType: "video/mp4",
    blobUrl: `https://private.example/${stage.toLowerCase()}.mp4`,
    createdAt: new Date("2026-10-20T14:00:00.000Z"),
    mediaSession: {
      serviceId: null,
      bookingId: "booking-legacy",
      booking: { serviceId: "service-1" },
      vendorJobVideoStage: stage,
      sessionType: "JOB_SERVICE_VIDEO",
    },
  };
}

describe("GET /api/services/discover public media linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.serviceCount.mockResolvedValue(1);
    h.serviceFindMany.mockResolvedValue([service]);
    h.promotionCampaignFindMany.mockResolvedValue([]);
    const assets = [
      legacyStageAsset("INTRO"),
      legacyStageAsset("IN_PROGRESS"),
      legacyStageAsset("COMPLETED"),
    ];
    h.mediaAssetFindMany.mockResolvedValue(assets);
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(assets.map((asset) => asset.id));
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(new Map());
  });

  it("uses the booking service for legacy sessions without relinking public blob urls", async () => {
    const response = await GET(
      new Request("http://localhost/api/services/discover?q=Breaker%20Replacement") as any
    );
    const json = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(h.mediaAssetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mediaSession: {
          OR: [
            { serviceId: { in: ["service-1"] } },
            {
              serviceId: null,
              booking: { is: { serviceId: { in: ["service-1"] } } },
            },
          ],
        },
      }),
      select: expect.objectContaining({
        mediaSession: expect.objectContaining({
          select: expect.objectContaining({
            booking: { select: { serviceId: true } },
          }),
        }),
      }),
    }));
    expect(json.results).toHaveLength(1);
    expect(json.results[0]).toMatchObject({
      serviceId: "service-1",
      previewMediaUrl: "/api/public/media/asset-completed",
      previewMediaType: "video",
      publicListing: {
        serviceEligible: true,
        hasPublicMedia: true,
      },
    });
    expect(JSON.stringify(json)).not.toContain("https://private.example/");
  });
});
