import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as assistPOST } from "./[reportId]/assist/route";
import { requireAdmin } from "@/lib/admin-auth";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { AiSchemaValidationError } from "@/lib/ai/errors";
import { getDisputeSummaryAssistantSuggestion } from "@/lib/ai/dispute-summary-assistant";

const hoisted = vi.hoisted(() => {
  const contentReportFindUnique = vi.fn();
  const contentReportCount = vi.fn();
  const bookingFindUnique = vi.fn();
  const vendorFindUnique = vi.fn();
  const reviewFindUnique = vi.fn();
  const mediaAssetFindUnique = vi.fn();
  const prisma = {
    contentReport: {
      findUnique: contentReportFindUnique,
      count: contentReportCount,
    },
    booking: {
      findUnique: bookingFindUnique,
    },
    vendor: {
      findUnique: vendorFindUnique,
    },
    review: {
      findUnique: reviewFindUnique,
    },
    mediaAsset: {
      findUnique: mediaAssetFindUnique,
    },
  };

  return {
    prisma,
    contentReportFindUnique,
    contentReportCount,
    bookingFindUnique,
    vendorFindUnique,
    reviewFindUnique,
    mediaAssetFindUnique,
  };
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

vi.mock("@/lib/ai/dispute-summary-assistant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/dispute-summary-assistant")>(
    "@/lib/ai/dispute-summary-assistant"
  );
  return {
    ...actual,
    getDisputeSummaryAssistantSuggestion: vi.fn(),
  };
});

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/admin/reported-content/[reportId]/assist", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    vi.mocked(isAiFeatureEnabled).mockReset();
    vi.mocked(isAiFeatureEnabled).mockReturnValue(true);
    vi.mocked(getDisputeSummaryAssistantSuggestion).mockReset();
    hoisted.contentReportFindUnique.mockReset();
    hoisted.contentReportCount.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.reviewFindUnique.mockReset();
    hoisted.mediaAssetFindUnique.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the report is missing", async () => {
    hoisted.contentReportFindUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 503 when the database is temporarily unavailable", async () => {
    hoisted.contentReportFindUnique.mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: "P1001" })
    );

    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe("DB_UNAVAILABLE");
    expect(json.retryable).toBe(true);
  });

  it("returns 503 when the feature flag is disabled", async () => {
    vi.mocked(isAiFeatureEnabled).mockReturnValue(false);
    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe("AI_FEATURE_DISABLED");
  });

  it("returns the AI suggestion for a review-targeted report", async () => {
    hoisted.contentReportFindUnique.mockResolvedValue({
      id: "report-1",
      targetType: "review",
      targetId: "review-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      reportedUserId: "user-1",
      reportedVendorId: "vendor-1",
      reporterUserId: "reporter-1",
      reporterVendorId: null,
      reporterRole: "customer",
      reasonCategory: "misleading",
      reasonDetail: "Customer says the review does not match the recorded visit.",
      status: "open",
      severity: "high",
      autoHidden: false,
      createdAt: new Date("2026-06-02T10:00:00.000Z"),
      resolvedAt: null,
      resolutionNotes: null,
    });
    hoisted.contentReportCount.mockResolvedValue(2);
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Move-out clean",
      status: "COMPLETED",
      service: { name: "Apartment Cleaning" },
      vendor: { name: "Metro", businessName: "Metro Home Care Pros" },
    });
    hoisted.vendorFindUnique.mockResolvedValue({
      name: "Metro",
      businessName: "Metro Home Care Pros",
    });
    hoisted.reviewFindUnique.mockResolvedValue({
      rating: 2,
      comment: "This video does not look like my apartment.",
      moderationStatus: "pending_review",
      visibilityStatus: "private",
      moderationReason: null,
      createdAt: new Date("2026-06-02T11:00:00.000Z"),
      source: "customer",
      jobType: "Move-out clean",
      assignedEmployeeName: "E2E Trust Employee",
    });
    hoisted.mediaAssetFindUnique.mockResolvedValue(null);
    vi.mocked(getDisputeSummaryAssistantSuggestion).mockResolvedValue({
      data: {
        summary: "The customer is disputing whether the posted review context matches the linked service visit.",
        disputeType: "video_or_verification",
        confidence: "medium",
        timeline: [
          "A customer filed a misleading-content report on the linked review.",
          "The linked review is still pending moderation and private.",
        ],
        disputedPoints: [
          "Whether the review references the correct recorded service visit.",
        ],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["repeat_reporting", "verification_gap"],
      },
      model: "gpt-5.4-mini",
      responseId: "resp_456",
      requestId: "req_456",
      usage: {
        inputTokens: 150,
        outputTokens: 80,
        totalTokens: 230,
      },
    });

    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.aiRunId).toBe("resp_456");
    expect(json.analysisScope).toBe("content_report_and_linked_records");
    expect(json.suggestion).toMatchObject({
      disputeType: "video_or_verification",
      confidence: "medium",
      recommendedNextStep: "needs_admin_review",
    });
    expect(vi.mocked(getDisputeSummaryAssistantSuggestion)).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: "report-1",
        targetType: "review",
        relatedTargetReportCount: 2,
        linkedReview: expect.objectContaining({
          rating: 2,
          jobType: "Move-out clean",
        }),
      }),
      "admin-1"
    );
  });

  it("returns 502 with retryable=false when AI output validation fails", async () => {
    hoisted.contentReportFindUnique.mockResolvedValue({
      id: "report-1",
      targetType: "review",
      targetId: "review-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      reportedUserId: "user-1",
      reportedVendorId: "vendor-1",
      reporterUserId: "reporter-1",
      reporterVendorId: null,
      reporterRole: "customer",
      reasonCategory: "misleading",
      reasonDetail: "Customer says the review does not match the recorded visit.",
      status: "open",
      severity: "high",
      autoHidden: false,
      createdAt: new Date("2026-06-02T10:00:00.000Z"),
      resolvedAt: null,
      resolutionNotes: null,
    });
    hoisted.contentReportCount.mockResolvedValue(1);
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Move-out clean",
      status: "COMPLETED",
      service: { name: "Apartment Cleaning" },
      vendor: { name: "Metro", businessName: "Metro Home Care Pros" },
    });
    hoisted.vendorFindUnique.mockResolvedValue({
      name: "Metro",
      businessName: "Metro Home Care Pros",
    });
    hoisted.reviewFindUnique.mockResolvedValue({
      rating: 2,
      comment: "This video does not look like my apartment.",
      moderationStatus: "pending_review",
      visibilityStatus: "private",
      moderationReason: null,
      createdAt: new Date("2026-06-02T11:00:00.000Z"),
      source: "customer",
      jobType: "Move-out clean",
      assignedEmployeeName: "E2E Trust Employee",
    });
    hoisted.mediaAssetFindUnique.mockResolvedValue(null);
    vi.mocked(getDisputeSummaryAssistantSuggestion).mockRejectedValue(
      new AiSchemaValidationError("Structured output did not match schema")
    );

    const req = new Request("http://localhost/api/admin/reported-content/report-1/assist", {
      method: "POST",
    });
    const res = await assistPOST(req, { params: Promise.resolve({ reportId: "report-1" }) });
    expect(res.status).toBe(502);
    const json = await readJson(res);
    expect(json.code).toBe("AI_SCHEMA_VALIDATION_ERROR");
    expect(json.retryable).toBe(false);
  });
});
