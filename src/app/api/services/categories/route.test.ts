import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => ({
  serviceFindMany: vi.fn(),
  mediaAssetFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    service: {
      findMany: hoisted.serviceFindMany,
    },
    mediaAsset: {
      findMany: hoisted.mediaAssetFindMany,
    },
  },
}));

vi.mock("@/lib/transient-db-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/transient-db-errors")>();
  return {
    ...actual,
    withTransientDbRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
  };
});

vi.mock("@/lib/service-video-publication", () => ({
  resolveCanonicalPublicAssetIds: vi.fn(),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

function createService(overrides: Record<string, any> = {}) {
  return {
    id: "service-1",
    name: "Outlet Installation",
    vendorId: "vendor-1",
    vendor: {
      category: "Electrical",
      businessType: "Electrical",
    },
    ...overrides,
  };
}

function createStageAsset(stage: "INTRO" | "IN_PROGRESS" | "COMPLETED") {
  return {
    id: `asset-${stage.toLowerCase()}`,
    mimeType: "video/mp4",
    blobUrl: `https://assets.example/${stage.toLowerCase()}.mp4`,
    mediaSession: {
      serviceId: "service-1",
      vendorJobVideoStage: stage,
      sessionType: "JOB_SERVICE_VIDEO",
    },
  };
}

describe("GET /api/services/categories", () => {
  beforeEach(() => {
    hoisted.serviceFindMany.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    vi.mocked(resolveCanonicalPublicAssetIds).mockReset();
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue([]);
  });

  it("does not show category cards for published services without a complete approved public proof package", async () => {
    hoisted.serviceFindMany.mockResolvedValue([createService()]);
    hoisted.mediaAssetFindMany.mockResolvedValue([]);

    const response = await GET();
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.categories).toEqual([]);
    expect(json.meta.countedServices).toBe(0);
    expect(json.meta.scannedPublishedServices).toBe(1);
  });

  it("counts a category when a service has an exact approved Public Final Result", async () => {
    hoisted.serviceFindMany.mockResolvedValue([createService()]);
    vi.mocked(resolveCanonicalPublicAssetIds).mockResolvedValue(["asset-completed"]);
    hoisted.mediaAssetFindMany.mockResolvedValue([createStageAsset("COMPLETED")]);

    const response = await GET();
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.categories).toEqual([
      {
        key: "electrical",
        label: "Electrical",
        serviceCount: 1,
        vendorCount: 1,
        sampleServices: ["Outlet Installation"],
      },
    ]);
    expect(json.meta.countedServices).toBe(1);
  });
});
