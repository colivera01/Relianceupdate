import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getUserIdFromRequest, getVendorIdFromRequest } from "@/lib/auth";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { AiRequestFailedError } from "@/lib/ai/errors";
import { getVendorCoachingSummarySuggestion } from "@/lib/ai/vendor-coaching-summary-assistant";

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
  getVendorIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/ai/feature-flags", () => ({
  isAiFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/ai/vendor-coaching-summary-assistant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/vendor-coaching-summary-assistant")>(
    "@/lib/ai/vendor-coaching-summary-assistant"
  );
  return {
    ...actual,
    getVendorCoachingSummarySuggestion: vi.fn(),
  };
});

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

const validBody = {
  vendorName: "Metro Home Care Pros",
  trustScore: {
    scored: true,
    totalScorePct: 98,
    explanationOverview: "Workflow and dispute-free outcomes are strong.",
    coverageSummary: "Coverage comes from 23 finalized workflows.",
    strongestSignals: ["Verified workflow completion is perfect."],
    watchItems: ["Operational reliability is the main drag."],
    improvementHints: ["Reduce cancellations and late completions."],
    components: {
      workflowCompletion: { pct: 100, numerator: 23, denominator: 23, weightPct: 30 },
      videoVerification: { pct: 100, numerator: 24, denominator: 24, weightPct: 25 },
      disputeFree: { pct: 100, numerator: 23, denominator: 23, weightPct: 30 },
      operationalReliability: { pct: 86.96, numerator: 20, denominator: 23, weightPct: 15 },
    },
  },
  coachingPlan: {
    summary: "Operational reliability is the main Trust Score drag.",
    priorityActions: ["Review canceled or late completions first."],
    strengths: ["Workflow completion is perfect right now."],
    operationalNotes: ["Storage is 82% full."],
  },
  dashboardSnapshot: {
    totalBookings: 16,
    totalClients: 3,
    rating: 4.8,
    ratingCount: 5,
    approvedVideos: 7,
    pendingVideos: 2,
    archivedVideos: 1,
    totalVideoAssets: 10,
    storagePercentUsed: 82,
    completedJobs: 1,
    inProgressJobs: 1,
    scheduledJobs: 0,
    reviewCoverage: 100,
  },
};

describe("POST /api/vendor/coaching-summary", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getVendorIdFromRequest).mockReset();
    vi.mocked(isAiFeatureEnabled).mockReset();
    vi.mocked(getVendorCoachingSummarySuggestion).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("vendor-user-1");
    vi.mocked(getVendorIdFromRequest).mockResolvedValue("vendor-1");
    vi.mocked(isAiFeatureEnabled).mockReturnValue(true);
  });

  it("returns 401 when vendor auth is missing", async () => {
    vi.mocked(getVendorIdFromRequest).mockResolvedValue(null);
    const request = new Request("http://localhost/api/vendor/coaching-summary", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 503 when the feature flag is disabled", async () => {
    vi.mocked(isAiFeatureEnabled).mockReturnValue(false);
    const request = new Request("http://localhost/api/vendor/coaching-summary", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
    const json = await readJson(response);
    expect(json.code).toBe("AI_FEATURE_DISABLED");
  });

  it("returns 422 when trust score is not yet ready", async () => {
    const request = new Request("http://localhost/api/vendor/coaching-summary", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        trustScore: {
          ...validBody.trustScore,
          scored: false,
          totalScorePct: null,
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("returns the AI coaching summary when inputs are valid", async () => {
    vi.mocked(getVendorCoachingSummarySuggestion).mockResolvedValue({
      data: {
        summary: "Keep operational reliability as the next coaching focus.",
        confidence: "medium",
        priorityHeadline: "Tighten operational reliability before scale.",
        recommendedFocus: ["Review late and canceled outcomes first."],
        positiveSignals: ["Workflow completion is strong."],
        watchouts: ["Pending video moderation still exists."],
        nextCheckIn: "Recheck after the next 5 finalized bookings.",
      },
      model: "gpt-5.4-mini",
      responseId: "resp_vendor_1",
      requestId: "req_vendor_1",
      usage: {
        inputTokens: 140,
        outputTokens: 80,
        totalTokens: 220,
      },
    });

    const request = new Request("http://localhost/api/vendor/coaching-summary", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.success).toBe(true);
    expect(json.suggestion).toMatchObject({
      confidence: "medium",
      priorityHeadline: "Tighten operational reliability before scale.",
    });
  });

  it("returns 502 with retryable=true when the AI provider call fails", async () => {
    vi.mocked(getVendorCoachingSummarySuggestion).mockRejectedValue(
      new AiRequestFailedError("Upstream OpenAI timeout")
    );

    const request = new Request("http://localhost/api/vendor/coaching-summary", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(502);
    const json = await readJson(response);
    expect(json.code).toBe("AI_REQUEST_FAILED");
    expect(json.retryable).toBe(true);
  });
});
