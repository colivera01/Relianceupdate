import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { loadAuthorizedPrivateProof } from "@/lib/service-video-evidence";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";
import { GET } from "./route";

const hoisted = vi.hoisted(() => ({
  serviceFindUnique: vi.fn(),
  bookingFindFirst: vi.fn(),
  mediaAssetFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    service: { findUnique: hoisted.serviceFindUnique },
    booking: { findFirst: hoisted.bookingFindFirst },
    mediaAsset: { findMany: hoisted.mediaAssetFindMany },
  },
}));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock("@/lib/service-video-evidence", () => ({ loadAuthorizedPrivateProof: vi.fn() }));
vi.mock("@/lib/service-video-publication", () => ({ resolveCanonicalPublicAssetIds: vi.fn() }));

const context = { params: Promise.resolve({ id: "service-1" }) };

describe("GET /api/services/[id]/media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      isPublished: true,
      vendor: { isPubliclyListed: true },
    });
    hoisted.bookingFindFirst.mockResolvedValue({ id: "booking-1" });
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    vi.mocked(loadAuthorizedPrivateProof).mockResolvedValue({ assetIds: ["asset-1", "asset-2", "asset-3"] } as any);
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(["public-asset"]);
  });

  it("requires an exact booking for customer media", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=customer"),
      context,
    );

    expect(response.status).toBe(400);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
    expect(loadAuthorizedPrivateProof).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it("denies a booking that does not match the customer and service", async () => {
    hoisted.bookingFindFirst.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=customer&bookingId=booking-2"),
      context,
    );

    expect(response.status).toBe(403);
    expect(hoisted.bookingFindFirst).toHaveBeenCalledWith({
      where: { id: "booking-2", userId: "customer-1", serviceId: "service-1" },
      select: { id: true },
    });
    expect(loadAuthorizedPrivateProof).not.toHaveBeenCalled();
  });

  it("denies customer media without an Active exact-package Private Proof", async () => {
    vi.mocked(loadAuthorizedPrivateProof).mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=customer&bookingId=booking-1"),
      context,
    );

    expect(response.status).toBe(403);
    expect(loadAuthorizedPrivateProof).toHaveBeenCalledWith({
      bookingId: "booking-1",
      customerUserId: "customer-1",
    });
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it("returns only the exact Private Proof assets for the exact booking", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=customer&bookingId=booking-1"),
      context,
    );

    expect(response.status).toBe(200);
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["asset-1", "asset-2", "asset-3"] },
        mediaSession: {
          bookingId: "booking-1",
          OR: [
            { serviceId: "service-1" },
            {
              serviceId: null,
              booking: { is: { serviceId: "service-1" } },
            },
          ],
        },
      }),
    }));
  });

  it("fails closed for the unsupported Vendor-internal audience", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=vendor_internal"),
      context,
    );

    expect(response.status).toBe(403);
    expect(hoisted.serviceFindUnique).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it("preserves canonical Public media resolution", async () => {
    hoisted.mediaAssetFindMany.mockResolvedValue([{
      id: "public-asset",
      vendorId: "vendor-1",
      mediaSessionId: "session-1",
      bytes: BigInt(100),
      mimeType: "video/mp4",
      blobKey: "private/public-asset.mp4",
      blobUrl: "https://private.example/public-asset.mp4",
      moderationStatus: "approved",
      visibilityStatus: "public",
      archiveStatus: "active",
      moderationReason: "internal moderation reason",
      moderatedAt: null,
      createdAt: new Date("2026-10-20T14:00:00.000Z"),
      mediaSession: {
        title: "internal session title",
        description: "internal session description",
        bookingId: "booking-legacy",
        serviceId: null,
        booking: { serviceId: "service-1" },
        vendorJobVideoStage: "COMPLETED",
        sessionType: "JOB_SERVICE_VIDEO",
      },
    }]);
    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=public"),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(resolveCanonicalPublicAssetIds).toHaveBeenCalledWith({ serviceId: "service-1" });
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["public-asset"] },
        mediaSession: {
          OR: [
            { serviceId: "service-1" },
            {
              serviceId: null,
              booking: { is: { serviceId: "service-1" } },
            },
          ],
        },
      }),
    }));
    expect(body.assets[0]).toEqual({
      id: "public-asset",
      mimeType: "video/mp4",
      blobUrl: "/api/public/media/public-asset",
      createdAt: "2026-10-20T14:00:00.000Z",
      serviceId: "service-1",
      isPrimaryProofVideo: true,
    });
    expect(body.videos[0]).toEqual(body.assets[0]);
    expect(body.images).toEqual([]);
    expect(Object.keys(body.assets[0]).sort()).toEqual([
      "blobUrl",
      "createdAt",
      "id",
      "isPrimaryProofVideo",
      "mimeType",
      "serviceId",
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("https://private.example/");
    expect(serialized).not.toContain("booking-legacy");
    expect(serialized).not.toContain("session-1");
    expect(serialized).not.toContain("private/public-asset.mp4");
    expect(serialized).not.toContain("internal moderation reason");
    expect(serialized).not.toContain("internal session title");
    expect(serialized).not.toContain("internal session description");
  });
});
