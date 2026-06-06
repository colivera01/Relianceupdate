import { describe, expect, it } from "vitest";
import {
  buildMediaModerationAssistantInput,
  normalizeMediaModerationAssistantResult,
} from "./moderation-assistant";

describe("media moderation assistant prompt", () => {
  it("builds an honest metadata-only input", () => {
    const input = buildMediaModerationAssistantInput({
      bookingId: "b1",
      vendorId: "v1",
      vendorName: "Metro Home Care Pros",
      jobTitle: "Apartment Deep Clean",
      bookingStatus: "CONFIRMED",
      serviceName: "Metro Apartment Deep Clean",
      stages: [
        {
          stageKey: "INTRO",
          title: "Before service walk-through",
          description: "Kitchen and bathroom before cleaning begins",
          mimeType: "video/mp4",
          fileSizeBytes: "1024",
          uploadedAt: "2026-06-02T10:00:00.000Z",
          currentModerationStatus: "pending_review",
          currentVisibilityStatus: "private",
          currentModerationReason: null,
          employeeName: "Tech A",
        },
      ],
    });

    expect(input).toContain("metadata-only");
    expect(input).toContain("Do not claim to have visually verified the content");
    expect(input).toContain("Booking titles may be custom labels");
    expect(input).toContain("Booking ID: b1");
    expect(input).toContain("Stage: INTRO");
    expect(input).toContain("Description: Kitchen and bathroom before cleaning begins");
  });
});

describe("normalizeMediaModerationAssistantResult", () => {
  it("downgrades high-confidence flag decisions for ambiguous repeated-stage metadata patterns", () => {
    const normalized = normalizeMediaModerationAssistantResult(
      {
        bookingId: "b1",
        vendorId: "v1",
        vendorName: "Metro Home Care Pros",
        jobTitle: "Verified Email Flow Audit",
        bookingStatus: "COMPLETED",
        serviceName: "Metro Apartment Deep Clean",
        stages: [
          {
            stageKey: "INTRO",
            title: "Intro",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.314Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "IN_PROGRESS",
            title: "Progress",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.320Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "COMPLETED",
            title: "Completed",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.289Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
        ],
      },
      {
        summary: "Metadata shows a clear job/service mismatch and repetitive stage files, so the package should be escalated before approval.",
        decision: "flag",
        confidence: "high",
        policyAreas: [
          "workflow integrity",
          "misleading labeling",
          "wrong-job risk",
          "metadata completeness",
        ],
        findings: [
          {
            label: "Job/service mismatch",
            detail: "The booking title differs from the linked service name.",
            evidence: ["Job title and service label do not match exactly."],
          },
        ],
        recommendedActions: ["Escalate the package before approval."],
      }
    );

    expect(normalized.decision).toBe("needs_human_review");
    expect(normalized.confidence).toBe("medium");
    expect(normalized.recommendedActions[0]).toBe(
      "Open the package and confirm each stage is a distinct recording before any approval decision."
    );
  });

  it("preserves higher-severity decisions when explicit moderation reasons are already present", () => {
    const normalized = normalizeMediaModerationAssistantResult(
      {
        bookingId: "b2",
        vendorId: "v2",
        vendorName: "Metro Home Care Pros",
        jobTitle: "Apartment Deep Clean",
        bookingStatus: "COMPLETED",
        serviceName: "Apartment Deep Clean",
        stages: [
          {
            stageKey: "INTRO",
            title: "Intro",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.314Z",
            currentModerationStatus: "flagged",
            currentVisibilityStatus: "private",
            currentModerationReason: "privacy concern",
            employeeName: null,
          },
          {
            stageKey: "IN_PROGRESS",
            title: "Progress",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.320Z",
            currentModerationStatus: "flagged",
            currentVisibilityStatus: "private",
            currentModerationReason: "privacy concern",
            employeeName: null,
          },
          {
            stageKey: "COMPLETED",
            title: "Completed",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.289Z",
            currentModerationStatus: "flagged",
            currentVisibilityStatus: "private",
            currentModerationReason: "privacy concern",
            employeeName: null,
          },
        ],
      },
      {
        summary: "Existing moderation reasons justify escalation.",
        decision: "flag",
        confidence: "high",
        policyAreas: ["workflow integrity", "metadata completeness"],
        findings: [
          {
            label: "Existing privacy flag",
            detail: "Each stage already carries a privacy moderation reason.",
            evidence: ["Current moderation reason: privacy concern"],
          },
        ],
        recommendedActions: ["Escalate the package before approval."],
      }
    );

    expect(normalized.decision).toBe("flag");
    expect(normalized.confidence).toBe("high");
  });

  it("caps high confidence even when the assistant already chose needs_human_review", () => {
    const normalized = normalizeMediaModerationAssistantResult(
      {
        bookingId: "b3",
        vendorId: "v3",
        vendorName: "Metro Home Care Pros",
        jobTitle: "Verified Email Flow Audit",
        bookingStatus: "COMPLETED",
        serviceName: "Metro Apartment Deep Clean",
        stages: [
          {
            stageKey: "INTRO",
            title: "Intro",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.314Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "IN_PROGRESS",
            title: "Progress",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.320Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "COMPLETED",
            title: "Completed",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.289Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
        ],
      },
      {
        summary: "Package is structurally complete but still ambiguous.",
        decision: "needs_human_review",
        confidence: "high",
        policyAreas: ["workflow integrity", "metadata completeness"],
        findings: [
          {
            label: "Possible duplicate stage uploads",
            detail: "The same file size appears across all three stages.",
            evidence: ["Same file size across intro, in-progress, and completed uploads."],
          },
        ],
        recommendedActions: ["Review the package manually."],
      }
    );

    expect(normalized.decision).toBe("needs_human_review");
    expect(normalized.confidence).toBe("medium");
  });

  it("normalizes ambiguous repeated-stage flag decisions even when confidence is already medium", () => {
    const normalized = normalizeMediaModerationAssistantResult(
      {
        bookingId: "b4",
        vendorId: "v4",
        vendorName: "Metro Home Care Pros",
        jobTitle: "Verified Email Flow Audit",
        bookingStatus: "COMPLETED",
        serviceName: "Metro Apartment Deep Clean",
        stages: [
          {
            stageKey: "INTRO",
            title: "Intro",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.314Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "IN_PROGRESS",
            title: "Progress",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.320Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
          {
            stageKey: "COMPLETED",
            title: "Completed",
            description: null,
            mimeType: "video/mp4",
            fileSizeBytes: "1128375",
            uploadedAt: "2026-06-01T15:45:58.289Z",
            currentModerationStatus: "pending_review",
            currentVisibilityStatus: "public",
            currentModerationReason: null,
            employeeName: null,
          },
        ],
      },
      {
        summary: "Package should be escalated before approval.",
        decision: "flag",
        confidence: "medium",
        policyAreas: ["workflow integrity", "metadata completeness"],
        findings: [
          {
            label: "Possible duplicate stage uploads",
            detail: "The same file size appears across all three stages.",
            evidence: ["Same file size across intro, in-progress, and completed uploads."],
          },
        ],
        recommendedActions: ["Escalate the package before approval."],
      }
    );

    expect(normalized.decision).toBe("needs_human_review");
    expect(normalized.confidence).toBe("medium");
  });
});
