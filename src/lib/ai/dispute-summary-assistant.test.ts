import { describe, expect, it } from "vitest";
import {
  buildDisputeSummaryAssistantInput,
  normalizeDisputeSummaryAssistantResult,
} from "./dispute-summary-assistant";
import { DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";

describe("buildDisputeSummaryAssistantInput", () => {
  it("builds a cautious report summary prompt with linked review and media context", () => {
    const input = buildDisputeSummaryAssistantInput({
      reportId: "report-1",
      targetType: "review",
      targetId: "review-1",
      reportStatus: "open",
      severity: "high",
      reasonCategory: "misleading",
      reasonDetail: "Customer says the uploaded media does not match the actual visit.",
      reporterRole: "customer",
      autoHidden: false,
      createdAt: "2026-06-02T10:00:00.000Z",
      resolvedAt: null,
      resolutionNotes: null,
      relatedTargetReportCount: 2,
      bookingId: "booking-1",
      bookingTitle: "Move-out clean",
      bookingStatus: "COMPLETED",
      serviceName: "Apartment Cleaning",
      vendorId: "vendor-1",
      vendorName: "Metro Home Care Pros",
      linkedReview: {
        rating: 2,
        comment: "The final video does not show my apartment.",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: "2026-06-02T11:00:00.000Z",
        source: "customer",
        jobType: "Move-out clean",
        assignedEmployeeName: "E2E Trust Employee",
      },
      linkedMediaAsset: {
        mimeType: "video/mp4",
        fileSizeBytes: "2048000",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        createdAt: "2026-06-02T09:45:00.000Z",
        sessionType: "JOB_SERVICE_VIDEO",
        stageKey: "COMPLETED",
        sessionTitle: "Completed Service",
        sessionDescription: "Final walkthrough",
        deviceType: "PHONE",
        employeeName: "E2E Trust Employee",
      },
    });

    expect(DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION).toBe("content-report-case-v1");
    expect(input).toContain("Reliance admin reported-content case summary request.");
    expect(input).toContain("Do not claim you interviewed the customer");
    expect(input).toContain("Report ID: report-1");
    expect(input).toContain("Reason category: misleading");
    expect(input).toContain("Total reports on this target: 2");
    expect(input).toContain("Linked review metadata:");
    expect(input).toContain("The final video does not show my apartment.");
    expect(input).toContain("Linked media metadata:");
    expect(input).toContain("Video stage: COMPLETED");
  });
});

describe("normalizeDisputeSummaryAssistantResult", () => {
  it("caps high confidence to medium for unresolved thin-evidence cases", () => {
    const normalized = normalizeDisputeSummaryAssistantResult(
      {
        reportId: "report-2",
        targetType: "review",
        targetId: "review-2",
        reportStatus: "open",
        severity: "medium",
        reasonCategory: "privacy",
        reasonDetail: "Customer says the review exposes too much personal detail.",
        reporterRole: "customer",
        autoHidden: false,
        createdAt: "2026-06-02T10:00:00.000Z",
        resolvedAt: null,
        resolutionNotes: null,
        relatedTargetReportCount: 3,
        bookingId: "booking-2",
        bookingTitle: "Kitchen cleanup",
        bookingStatus: "COMPLETED",
        serviceName: "Cleaning",
        vendorId: "vendor-2",
        vendorName: "Metro Home Care Pros",
        linkedReview: {
          rating: 5,
          comment: "Fast and kind service.",
          moderationStatus: "approved",
          visibilityStatus: "public",
          moderationReason: null,
          createdAt: "2026-06-02T11:00:00.000Z",
          source: "customer",
          jobType: "Kitchen cleanup",
          assignedEmployeeName: "E2E Trust Employee",
        },
        linkedMediaAsset: null,
      },
      {
        summary: "Open privacy report on a public review with limited supporting evidence.",
        disputeType: "other",
        confidence: "high",
        timeline: ["Review approved publicly."],
        disputedPoints: ["Customer says the review reveals too much detail."],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["public review is already approved"],
      }
    );

    expect(normalized.confidence).toBe("medium");
    expect(normalized.riskFlags).toContain("limited metadata evidence");
  });

  it("keeps high confidence when linked media evidence is present", () => {
    const normalized = normalizeDisputeSummaryAssistantResult(
      {
        reportId: "report-3",
        targetType: "media",
        targetId: "media-3",
        reportStatus: "open",
        severity: "high",
        reasonCategory: "misleading",
        reasonDetail: "Customer says the uploaded completion video is from the wrong property.",
        reporterRole: "customer",
        autoHidden: true,
        createdAt: "2026-06-02T10:00:00.000Z",
        resolvedAt: null,
        resolutionNotes: null,
        relatedTargetReportCount: 1,
        bookingId: "booking-3",
        bookingTitle: "Move-out clean",
        bookingStatus: "COMPLETED",
        serviceName: "Apartment Cleaning",
        vendorId: "vendor-3",
        vendorName: "Metro Home Care Pros",
        linkedReview: null,
        linkedMediaAsset: {
          mimeType: "video/mp4",
          fileSizeBytes: "2048000",
          moderationStatus: "approved",
          visibilityStatus: "public",
          moderationReason: null,
          createdAt: "2026-06-02T09:45:00.000Z",
          sessionType: "JOB_SERVICE_VIDEO",
          stageKey: "COMPLETED",
          sessionTitle: "Completed Service",
          sessionDescription: "Final walkthrough",
          deviceType: "PHONE",
          employeeName: "E2E Trust Employee",
        },
      },
      {
        summary: "Metadata points to a specific public video under dispute.",
        disputeType: "video_or_verification",
        confidence: "high",
        timeline: ["Completion video was approved publicly."],
        disputedPoints: ["Customer says the completion video is inaccurate."],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["public media is already approved"],
      }
    );

    expect(normalized.confidence).toBe("high");
    expect(normalized.riskFlags).not.toContain("limited metadata evidence");
  });

  it("adds the limited metadata evidence flag even when confidence is already medium", () => {
    const normalized = normalizeDisputeSummaryAssistantResult(
      {
        reportId: "report-4",
        targetType: "review",
        targetId: "review-4",
        reportStatus: "open",
        severity: "medium",
        reasonCategory: "privacy",
        reasonDetail: "Customer says the review mentions too much.",
        reporterRole: "customer",
        autoHidden: false,
        createdAt: "2026-06-02T10:00:00.000Z",
        resolvedAt: null,
        resolutionNotes: null,
        relatedTargetReportCount: 1,
        bookingId: "booking-4",
        bookingTitle: "Office clean",
        bookingStatus: "COMPLETED",
        serviceName: "Cleaning",
        vendorId: "vendor-4",
        vendorName: "Metro Home Care Pros",
        linkedReview: {
          rating: 5,
          comment: "Clear communication and great results.",
          moderationStatus: "approved",
          visibilityStatus: "public",
          moderationReason: null,
          createdAt: "2026-06-02T11:00:00.000Z",
          source: "customer",
          jobType: "Office clean",
          assignedEmployeeName: "E2E Trust Employee",
        },
        linkedMediaAsset: null,
      },
      {
        summary: "Open privacy report on a public review with incomplete supporting evidence.",
        disputeType: "other",
        confidence: "medium",
        timeline: ["Review approved publicly."],
        disputedPoints: ["Customer says the review reveals too much detail."],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["public review is already approved"],
      }
    );

    expect(normalized.confidence).toBe("medium");
    expect(normalized.riskFlags).toContain("limited metadata evidence");
  });
});
