import { describe, expect, it } from "vitest";
import { AiSchemaValidationError } from "./errors";
import {
  assertDisputeSummaryOutputSafe,
  assertModerationAssistantOutputSafe,
  assertVendorCoachingSummaryOutputSafe,
} from "./output-guards";

describe("AI output guards", () => {
  it("allows cautious moderation output that stays within metadata-only scope", () => {
    expect(() =>
      assertModerationAssistantOutputSafe({
        summary:
          "Metadata is internally consistent, but the package still needs a human check before approval.",
        decision: "needs_human_review",
        confidence: "medium",
        policyAreas: ["workflow integrity"],
        findings: [
          {
            label: "Distinct stages present",
            detail: "Intro, In Progress, and Completed stages were all submitted.",
            evidence: ["Three stage records were found."],
          },
        ],
        recommendedActions: ["Open the completed stage first and review manually."],
      })
    ).not.toThrow();
  });

  it("rejects moderation output that falsely claims visual review", () => {
    expect(() =>
      assertModerationAssistantOutputSafe({
        summary: "I watched the completed video and it shows the wrong home interior.",
        decision: "reject",
        confidence: "high",
        policyAreas: ["misleading labeling"],
        findings: [],
        recommendedActions: [],
      })
    ).toThrow(AiSchemaValidationError);
  });

  it("rejects dispute output that falsely claims party interviews", () => {
    expect(() =>
      assertDisputeSummaryOutputSafe({
        summary: "We interviewed the customer and vendor before recommending follow-up.",
        disputeType: "other",
        confidence: "medium",
        timeline: [],
        disputedPoints: [],
        recommendedNextStep: "needs_admin_review",
        riskFlags: [],
      })
    ).toThrow(AiSchemaValidationError);
  });

  it("rejects dispute output that falsely claims raw video review", () => {
    expect(() =>
      assertDisputeSummaryOutputSafe({
        summary: "After watching the footage, the case appears resolved.",
        disputeType: "video_or_verification",
        confidence: "high",
        timeline: [],
        disputedPoints: [],
        recommendedNextStep: "close_no_action",
        riskFlags: [],
      })
    ).toThrow(AiSchemaValidationError);
  });

  it("rejects vendor coaching output that falsely claims direct review evidence", () => {
    expect(() =>
      assertVendorCoachingSummaryOutputSafe({
        summary: "I watched the video and verified your team did great work.",
        confidence: "medium",
        priorityHeadline: "Keep your staged workflow consistent.",
        recommendedFocus: [],
        positiveSignals: [],
        watchouts: [],
        nextCheckIn: "Recheck after the next 5 finalized bookings.",
      })
    ).toThrow(AiSchemaValidationError);
  });
});
