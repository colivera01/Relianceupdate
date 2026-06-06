import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as assistPOST } from "./packages/[bookingId]/assist/route";
import { requireAdmin } from "@/lib/admin-auth";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { AiRequestFailedError } from "@/lib/ai/errors";
import { getMediaModerationAssistantSuggestion } from "@/lib/ai/moderation-assistant";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const prisma = {
    booking: {
      findUnique: bookingFindUnique,
    },
    mediaAsset: {
      findMany: mediaAssetFindMany,
    },
  };

  return { prisma, bookingFindUnique, mediaAssetFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/ai/feature-flags", () => ({
  isAiFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/ai/moderation-assistant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/moderation-assistant")>(
    "@/lib/ai/moderation-assistant"
  );
  return {
    ...actual,
    getMediaModerationAssistantSuggestion: vi.fn(),
  };
});

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/admin/media/packages/[bookingId]/assist", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    vi.mocked(isAiFeatureEnabled).mockReset();
    vi.mocked(isAiFeatureEnabled).mockReturnValue(true);
    vi.mocked(getMediaModerationAssistantSuggestion).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 422 when the package is incomplete", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "b1",
      vendorId: "v1",
      title: "HVAC tune-up",
      status: "CONFIRMED",
      vendor: { name: "Vendor A", businessName: null },
      service: { name: "HVAC" },
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        mimeType: "video/mp4",
        bytes: BigInt(100),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "INTRO",
          title: "Intro",
          description: "Before service",
          employee: { name: "Tech A" },
        },
      },
    ]);

    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(422);
  });

  it("returns 503 when the database is temporarily unavailable", async () => {
    hoisted.bookingFindUnique.mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: "P1001" })
    );

    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe("DB_UNAVAILABLE");
    expect(json.retryable).toBe(true);
  });

  it("returns 503 when the feature flag is disabled", async () => {
    vi.mocked(isAiFeatureEnabled).mockReturnValue(false);
    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe("AI_FEATURE_DISABLED");
  });

  it("returns the AI suggestion for a complete package", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "b1",
      vendorId: "v1",
      title: "HVAC tune-up",
      status: "CONFIRMED",
      vendor: { name: "Vendor A", businessName: "Vendor A LLC" },
      service: { name: "HVAC" },
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        mimeType: "video/mp4",
        bytes: BigInt(100),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "INTRO",
          title: "Intro",
          description: "Before service",
          employee: { name: "Tech A" },
        },
      },
      {
        mimeType: "video/mp4",
        bytes: BigInt(200),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:05:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "IN_PROGRESS",
          title: "Progress",
          description: "Cleaning underway",
          employee: { name: "Tech B" },
        },
      },
      {
        mimeType: "video/mp4",
        bytes: BigInt(300),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:10:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "COMPLETED",
          title: "Completed",
          description: "Final walkthrough",
          employee: { name: "Tech C" },
        },
      },
    ]);
    vi.mocked(getMediaModerationAssistantSuggestion).mockResolvedValue({
      data: {
        summary: "Metadata looks internally consistent but still needs a human check.",
        decision: "needs_human_review",
        confidence: "medium",
        policyAreas: ["workflow_integrity"],
        findings: [
          {
            label: "Consistent staged package",
            detail: "All required stages are present with matching service context.",
            evidence: ["Intro, In Progress, and Completed stages were found."],
          },
        ],
        recommendedActions: ["Open the stage detail dialog and review the completed stage first."],
      },
      model: "gpt-5.4-mini",
      responseId: "resp_123",
      requestId: "req_123",
      usage: {
        inputTokens: 120,
        outputTokens: 60,
        totalTokens: 180,
      },
    });

    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.aiRunId).toBe("resp_123");
    expect(json.analysisScope).toBe("metadata_only");
    expect(json.suggestion).toMatchObject({
      decision: "needs_human_review",
      confidence: "medium",
    });
  });

  it("returns 502 with retryable=true when the AI provider call fails", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "b1",
      vendorId: "v1",
      title: "HVAC tune-up",
      status: "CONFIRMED",
      vendor: { name: "Vendor A", businessName: "Vendor A LLC" },
      service: { name: "HVAC" },
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        mimeType: "video/mp4",
        bytes: BigInt(100),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "INTRO",
          title: "Intro",
          description: "Before service",
          employee: { name: "Tech A" },
        },
      },
      {
        mimeType: "video/mp4",
        bytes: BigInt(200),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:05:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "IN_PROGRESS",
          title: "Progress",
          description: "Cleaning underway",
          employee: { name: "Tech B" },
        },
      },
      {
        mimeType: "video/mp4",
        bytes: BigInt(300),
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: new Date("2026-06-02T10:10:00.000Z"),
        mediaSession: {
          vendorJobVideoStage: "COMPLETED",
          title: "Completed",
          description: "Final walkthrough",
          employee: { name: "Tech C" },
        },
      },
    ]);
    vi.mocked(getMediaModerationAssistantSuggestion).mockRejectedValue(
      new AiRequestFailedError("Upstream OpenAI timeout")
    );

    const req = new Request("http://localhost/api/admin/media/packages/b1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ bookingId: "b1" }) });
    expect(res.status).toBe(502);
    const json = await readJson(res);
    expect(json.code).toBe("AI_REQUEST_FAILED");
    expect(json.retryable).toBe(true);
  });
});
