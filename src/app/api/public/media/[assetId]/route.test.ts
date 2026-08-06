import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { generateDownloadUrl } from "@/lib/azure-blob-storage";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => ({
  mediaAssetFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    mediaAsset: { findFirst: hoisted.mediaAssetFindFirst },
  },
}));

vi.mock("@/lib/azure-blob-storage", () => ({
  generateDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/service-video-publication", () => ({
  resolveCanonicalPublicAssetIds: vi.fn(),
}));

describe("GET /api/public/media/[assetId]", () => {
  beforeEach(() => {
    hoisted.mediaAssetFindFirst.mockReset();
    vi.mocked(generateDownloadUrl).mockReset();
    vi.mocked(resolveCanonicalPublicAssetIds).mockReset();
  });

  it("serves a short-lived redirect only for the exact canonically eligible media version", async () => {
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(["asset-public"]);
    hoisted.mediaAssetFindFirst.mockResolvedValue({ blobKey: "proof/final-v3.webm" });
    vi.mocked(generateDownloadUrl).mockResolvedValue("https://blob.example/final-v3.webm?sig=short-lived");

    const response = await GET(new Request("http://localhost/api/public/media/asset-public"), {
      params: Promise.resolve({ assetId: "asset-public" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://blob.example/final-v3.webm?sig=short-lived");
    expect(generateDownloadUrl).toHaveBeenCalledWith("proof/final-v3.webm", 2);
  });

  it("fails closed when the approval chain is stale, revoked, superseded, or inconsistent", async () => {
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/public/media/asset-old"), {
      params: Promise.resolve({ assetId: "asset-old" }),
    });

    expect(response.status).toBe(404);
    expect(hoisted.mediaAssetFindFirst).not.toHaveBeenCalled();
    expect(generateDownloadUrl).not.toHaveBeenCalled();
  });

  it("fails closed when the eligible media blob is no longer active and saved", async () => {
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(["asset-public"]);
    hoisted.mediaAssetFindFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/public/media/asset-public"), {
      params: Promise.resolve({ assetId: "asset-public" }),
    });

    expect(response.status).toBe(404);
    expect(generateDownloadUrl).not.toHaveBeenCalled();
  });
});
