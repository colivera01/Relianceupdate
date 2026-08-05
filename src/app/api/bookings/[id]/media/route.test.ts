import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  bookingFindUnique: vi.fn(),
  mediaAssetFindMany: vi.fn(),
  loadAuthorizedPrivateProof: vi.fn(),
  recordPrivateProofAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: hoisted.getUserIdFromRequest }));
vi.mock("@/lib/account-status", () => ({
  ensureUserAccountCanAct: vi.fn(async () => undefined),
  AccountStatusError: class AccountStatusError extends Error {},
  accountStatusErrorBody: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findUnique: hoisted.bookingFindUnique },
    mediaAsset: { findMany: hoisted.mediaAssetFindMany },
  },
}));
vi.mock("@/lib/service-video-evidence", () => ({
  loadAuthorizedPrivateProof: hoisted.loadAuthorizedPrivateProof,
  recordPrivateProofAccess: hoisted.recordPrivateProofAccess,
}));

describe("customer Private Service Video list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getUserIdFromRequest.mockResolvedValue("customer-1");
    hoisted.recordPrivateProofAccess.mockResolvedValue(undefined);
  });

  it("blocks a customer from another customer's work record", async () => {
    const { GET } = await import("./route");
    hoisted.bookingFindUnique.mockResolvedValue({ id: "booking-1", userId: "customer-2", vendorId: "vendor-1" });

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/media"), {
      params: Promise.resolve({ id: "booking-1" }),
    });

    expect(response.status).toBe(403);
    expect(hoisted.loadAuthorizedPrivateProof).not.toHaveBeenCalled();
  });

  it("returns no media when the approved evidence chain is incomplete", async () => {
    const { GET } = await import("./route");
    hoisted.bookingFindUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1", vendorId: "vendor-1" });
    hoisted.loadAuthorizedPrivateProof.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/media"), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ privateProofStatus: "NOT_AVAILABLE", assets: [] });
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it("returns only assets bound to the authorized package and records the view", async () => {
    const { GET } = await import("./route");
    hoisted.bookingFindUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1", vendorId: "vendor-1" });
    hoisted.loadAuthorizedPrivateProof.mockResolvedValue({
      grant: { id: "grant-1" },
      package: { id: "package-1" },
      assetIds: ["asset-1", "asset-2", "asset-3"],
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "asset-3",
        vendorId: "vendor-1",
        mediaSessionId: "session-3",
        bytes: BigInt(100),
        mimeType: "video/webm",
        blobKey: "private/asset-3.webm",
        blobUrl: "https://blob.invalid/private/asset-3.webm",
        moderationStatus: "approved",
        visibilityStatus: "customer_only",
        archiveStatus: "active",
        moderationReason: null,
        moderatedAt: new Date("2026-08-05T12:00:00Z"),
        createdAt: new Date("2026-08-05T11:00:00Z"),
        mediaSession: {
          title: "Final Result",
          description: "Completed work",
          bookingId: "booking-1",
          serviceId: "service-1",
          vendorJobVideoStage: "COMPLETED",
          sessionType: "JOB_SERVICE_VIDEO",
        },
      },
    ]);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/media"), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      privateProofStatus: "AVAILABLE",
      assets: [{ id: "asset-3", blobUrl: null, downloadUrl: "/api/bookings/booking-1/media/asset-3/download" }],
    });
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["asset-1", "asset-2", "asset-3"] } }) }),
    );
    expect(hoisted.recordPrivateProofAccess).toHaveBeenCalledWith(
      expect.objectContaining({ grantId: "grant-1", packageId: "package-1", eventType: "VIEW" }),
    );
  });
});
