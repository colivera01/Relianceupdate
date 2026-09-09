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
        mediaSession: { serviceId: "service-1", bookingId: "booking-1" },
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
    const response = await GET(
      new NextRequest("http://localhost/api/services/service-1/media?audience=public"),
      context,
    );

    expect(response.status).toBe(200);
    expect(resolveCanonicalPublicAssetIds).toHaveBeenCalledWith({ serviceId: "service-1" });
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["public-asset"] } }),
    }));
  });
});
