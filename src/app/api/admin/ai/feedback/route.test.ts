import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { logAiOperatorFeedback } from "@/lib/ai/feedback";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/ai/feedback", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/feedback")>(
    "@/lib/ai/feedback"
  );
  return {
    ...actual,
    logAiOperatorFeedback: vi.fn(),
  };
});

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/admin/ai/feedback", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(logAiOperatorFeedback).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const response = await POST(
      new Request("http://localhost/api/admin/ai/feedback", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(response.status).toBe(403);
  });

  it("returns 422 when required fields are missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/ai/feedback", {
        method: "POST",
        body: JSON.stringify({
          feature: "moderation_assistant",
          outcome: "accepted",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for unsupported values", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/ai/feedback", {
        method: "POST",
        body: JSON.stringify({
          aiRunId: "resp_1",
          feature: "not_real",
          operation: "review_media_package",
          relatedEntityType: "booking",
          relatedEntityId: "booking-1",
          outcome: "accepted",
          source: "admin_media_moderation",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(response.status).toBe(422);
  });

  it("records a valid feedback event", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/ai/feedback", {
        method: "POST",
        body: JSON.stringify({
          aiRunId: "resp_1",
          feature: "moderation_assistant",
          operation: "review_media_package",
          relatedEntityType: "booking",
          relatedEntityId: "booking-1",
          outcome: "overrode",
          source: "admin_media_moderation",
          recommendedAction: "needs_human_review",
          actualAction: "approve",
          promptVersion: "media-package-metadata-v1",
          model: "gpt-5.4-mini",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    expect(logAiOperatorFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRunId: "resp_1",
        actorUserId: "admin-1",
        feature: "moderation_assistant",
        operation: "review_media_package",
        relatedEntityType: "booking",
        relatedEntityId: "booking-1",
        outcome: "overrode",
        source: "admin_media_moderation",
      })
    );

    const json = await readJson(response);
    expect(json.success).toBe(true);
  });
});
