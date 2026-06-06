import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    adminAuditLog: {
      findMany: vi.fn(),
    },
  },
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/admin/activity/ai-export", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" } as any);
    vi.mocked((prisma as any).adminAuditLog.findMany).mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const response = await GET(
      new Request("http://localhost/api/admin/activity/ai-export")
    );
    expect(response.status).toBe(403);
  });

  it("returns 401 when auth is missing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Unauthorized"));
    const response = await GET(
      new Request("http://localhost/api/admin/activity/ai-export")
    );
    expect(response.status).toBe(401);
  });

  it("returns filtered JSON export by default", async () => {
    vi.mocked((prisma as any).adminAuditLog.findMany)
      .mockResolvedValueOnce([
        {
          id: "log_1",
          actionType: "ai_response",
          entityId: "booking_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T13:00:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            operation: "review_media_package",
            responseId: "resp_1",
          }),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "feedback_1",
          actionType: "ai_feedback",
          entityId: "resp_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T13:05:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            outcome: "accepted",
          }),
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/activity/ai-export?aiFeature=moderation_assistant"
      )
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.success).toBe(true);
    expect((json.appliedFilter as any).aiFeature).toBe("moderation_assistant");
    expect((json.report as any).responseCount).toBe(1);
    expect((json.report as any).recentRuns[0].feature).toBe("moderation_assistant");
  });

  it("returns CSV when requested", async () => {
    vi.mocked((prisma as any).adminAuditLog.findMany)
      .mockResolvedValueOnce([
        {
          id: "log_1",
          actionType: "ai_response",
          entityId: "booking_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T13:00:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            operation: "review_media_package",
            responseId: "resp_1",
          }),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost/api/admin/activity/ai-export?format=csv")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const text = await response.text();
    expect(text).toContain("aiRunId,feature,featureLabel");
    expect(text).toContain("resp_1,moderation_assistant,Moderation Assistant");
  });
});
