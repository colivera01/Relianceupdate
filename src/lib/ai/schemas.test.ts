import { describe, expect, it } from "vitest";
import {
  disputeSummaryResultSchema,
  moderationAssistantResultSchema,
} from "./schemas";

describe("ai schemas", () => {
  it("parses a valid moderation assistant payload", () => {
    const parsed = moderationAssistantResultSchema.parse({
      summary: "The video is usable but should be reviewed by a human moderator.",
      decision: "needs_human_review",
      confidence: "medium",
      findings: [
        {
          label: "Ambiguous content",
          detail: "The clip includes people in the background without a clear view of context.",
          evidence: ["Background bystanders are visible in the opening frame."],
        },
      ],
      policyAreas: ["privacy"],
      recommendedActions: ["Confirm whether customer consent covers background footage."],
    });

    expect(parsed.decision).toBe("needs_human_review");
    expect(parsed.findings).toHaveLength(1);
  });

  it("parses a valid dispute summary payload", () => {
    const parsed = disputeSummaryResultSchema.parse({
      summary: "Customer says the completion video does not match the scheduled service window.",
      disputeType: "video_or_verification",
      confidence: "high",
      timeline: ["Booking created May 30", "Completion video uploaded June 1"],
      disputedPoints: ["Whether the final video shows the right service appointment."],
      recommendedNextStep: "needs_admin_review",
      riskFlags: ["timeline_mismatch"],
    });

    expect(parsed.disputeType).toBe("video_or_verification");
    expect(parsed.recommendedNextStep).toBe("needs_admin_review");
  });
});
