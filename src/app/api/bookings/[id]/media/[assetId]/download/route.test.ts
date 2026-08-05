import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  bookingFindUnique: vi.fn(),
  mediaAssetFindUnique: vi.fn(),
  loadAuthorizedPrivateProof: vi.fn(),
  recordPrivateProofAccess: vi.fn(),
  generateDownloadUrl: vi.fn(),
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
    mediaAsset: { findUnique: hoisted.mediaAssetFindUnique },
  },
}));
vi.mock("@/lib/service-video-evidence", () => ({
  loadAuthorizedPrivateProof: hoisted.loadAuthorizedPrivateProof,
  recordPrivateProofAccess: hoisted.recordPrivateProofAccess,
}));
vi.mock("@/lib/azure-blob-storage", () => ({ generateDownloadUrl: hoisted.generateDownloadUrl }));

describe("customer Private Service Video download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getUserIdFromRequest.mockResolvedValue("customer-1");
    hoisted.bookingFindUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1" });
    hoisted.recordPrivateProofAccess.mockResolvedValue(undefined);
  });

  it("blocks an asset that is not part of the customer's approved package", async () => {
    const { GET } = await import("./route");
    hoisted.loadAuthorizedPrivateProof.mockResolvedValue({
      grant: { id: "grant-1" },
      package: { id: "package-1" },
      assetIds: ["asset-1"],
    });

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/media/asset-2/download"), {
      params: Promise.resolve({ id: "booking-1", assetId: "asset-2" }),
    });

    expect(response.status).toBe(403);
    expect(hoisted.mediaAssetFindUnique).not.toHaveBeenCalled();
  });

  it("redirects only an approved active customer-only asset from the authorized package", async () => {
    const { GET } = await import("./route");
    hoisted.loadAuthorizedPrivateProof.mockResolvedValue({
      grant: { id: "grant-1" },
      package: { id: "package-1" },
      assetIds: ["asset-1"],
    });
    hoisted.mediaAssetFindUnique.mockResolvedValue({
      id: "asset-1",
      blobKey: "private/asset-1.webm",
      blobUrl: null,
      mimeType: "video/webm",
      moderationStatus: "approved",
      visibilityStatus: "customer_only",
      archiveStatus: "active",
      mediaSession: { bookingId: "booking-1" },
    });
    hoisted.generateDownloadUrl.mockResolvedValue("https://storage.example.test/asset-1?signed=1");

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/media/asset-1/download"), {
      params: Promise.resolve({ id: "booking-1", assetId: "asset-1" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://storage.example.test/asset-1?signed=1");
    expect(hoisted.recordPrivateProofAccess).toHaveBeenCalledWith(
      expect.objectContaining({ grantId: "grant-1", packageId: "package-1", mediaAssetId: "asset-1", eventType: "DOWNLOAD" }),
    );
  });
});
