import { describe, expect, it } from "vitest";
import {
  collectDisputeSummaryText,
  collectModerationAssistantText,
  collectVendorCoachingSummaryText,
  evaluateDisputeSummaryExpectation,
  evaluateModerationAssistantExpectation,
  evaluateVendorCoachingSummaryExpectation,
  matchesAnySignal,
} from "./evals";

describe("matchesAnySignal", () => {
  it("matches phrases case-insensitively across normalized whitespace", () => {
    expect(
      matchesAnySignal("Evidence is limited to metadata and review text only.", [
        "limited evidence",
        "review   text only",
      ])
    ).toBe(true);
  });
});

describe("evaluateModerationAssistantExpectation", () => {
  it("passes when the moderation output matches the saved eval expectation", () => {
    const result = evaluateModerationAssistantExpectation(
      {
        summary:
          "All three stages are present, but identical file size across uploads suggests duplicate media reuse.",
        decision: "needs_human_review",
        confidence: "medium",
        policyAreas: ["workflow integrity", "metadata completeness"],
        findings: [
          {
            label: "Possible duplicate stage uploads",
            detail: "The same file size appears across all three stages.",
            evidence: ["Same file size across intro, in-progress, and completed uploads."],
          },
          {
            label: "Missing employee attribution",
            detail: "Employee label is absent from the package metadata.",
            evidence: ["Employee label not recorded."],
          },
        ],
        recommendedActions: ["Review public visibility before approval."],
      },
      {
        expectedDecision: "needs_human_review",
        expectedConfidence: "medium",
        requiredSignalGroups: [["duplicate", "same file size"], ["employee"], ["public visibility"]],
      }
    );

    expect(result).toEqual({ passed: true, failures: [] });
  });

  it("fails when the moderation output misses required signals", () => {
    const result = evaluateModerationAssistantExpectation(
      {
        summary: "Package looks fine.",
        decision: "approve",
        confidence: "high",
        policyAreas: ["workflow integrity"],
        findings: [],
        recommendedActions: [],
      },
      {
        expectedDecision: "needs_human_review",
        expectedConfidence: "medium",
        requiredSignalGroups: [["duplicate"], ["employee"]],
      }
    );

    expect(result.passed).toBe(false);
    expect(result.failures.some((failure) => failure.includes('Expected decision "needs_human_review"'))).toBe(true);
    expect(result.failures.some((failure) => failure.includes("Missing expected signal group"))).toBe(true);
  });
});

describe("evaluateDisputeSummaryExpectation", () => {
  it("passes when the dispute output matches the saved eval expectation", () => {
    const result = evaluateDisputeSummaryExpectation(
      {
        summary:
          "Open privacy report on a public review. No linked media is available, and the evidence is limited to metadata and review text only.",
        disputeType: "other",
        confidence: "medium",
        timeline: ["Public review was already approved."],
        disputedPoints: ["Customer says the review reveals too much personal detail."],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["privacy concern", "no linked media available", "limited metadata evidence"],
      },
      {
        expectedNextStep: "needs_admin_review",
        expectedConfidence: ["low", "medium"],
        requiredSignalGroups: [["privacy"], ["no linked media"], ["metadata", "review text only"]],
      }
    );

    expect(result).toEqual({ passed: true, failures: [] });
  });

  it("accepts any allowed confidence value from a conservative range", () => {
    const result = evaluateDisputeSummaryExpectation(
      {
        summary: "No linked media is available and the evidence is one-sided/incomplete.",
        disputeType: "other",
        confidence: "low",
        timeline: [],
        disputedPoints: [],
        recommendedNextStep: "needs_admin_review",
        riskFlags: ["privacy allegation"],
      },
      {
        expectedNextStep: "needs_admin_review",
        expectedConfidence: ["low", "medium"],
        requiredSignalGroups: [["one-sided/incomplete"]],
      }
    );

    expect(result).toEqual({ passed: true, failures: [] });
  });
});

describe("text collectors", () => {
  it("collects moderation assistant text into a searchable body", () => {
    const text = collectModerationAssistantText({
      summary: "Summary",
      decision: "flag",
      confidence: "high",
      policyAreas: ["workflow integrity"],
      findings: [{ label: "Label", detail: "Detail", evidence: ["Evidence"] }],
      recommendedActions: ["Action"],
    });

    expect(text).toContain("workflow integrity");
    expect(text).toContain("Evidence");
  });

  it("collects dispute summary text into a searchable body", () => {
    const text = collectDisputeSummaryText({
      summary: "Summary",
      disputeType: "other",
      confidence: "medium",
      timeline: ["Timeline"],
      disputedPoints: ["Point"],
      recommendedNextStep: "needs_admin_review",
      riskFlags: ["Flag"],
    });

    expect(text).toContain("Timeline");
    expect(text).toContain("Flag");
  });

  it("collects vendor coaching summary text into a searchable body", () => {
    const text = collectVendorCoachingSummaryText({
      summary: "Operational reliability should be the next focus.",
      confidence: "medium",
      priorityHeadline: "Reduce cancellations first.",
      recommendedFocus: ["Review late completions."],
      positiveSignals: ["Workflow completion is perfect."],
      watchouts: ["Storage is 82% full."],
      nextCheckIn: "Recheck after the next 5 finalized bookings.",
    });

    expect(text).toContain("Operational reliability");
    expect(text).toContain("Storage is 82% full.");
  });
});

describe("evaluateVendorCoachingSummaryExpectation", () => {
  it("passes when the vendor coaching summary matches the saved eval expectation", () => {
    const result = evaluateVendorCoachingSummaryExpectation(
      {
        summary:
          "Metro is strong overall, but operational reliability should be the next coaching focus while workflow completion and dispute-free outcomes stay protected.",
        confidence: "medium",
        priorityHeadline:
          "Reduce cancellations and late completions to improve operational reliability.",
        recommendedFocus: ["Review cancellations and late completions first."],
        positiveSignals: [
          "Workflow completion is perfect.",
          "Dispute-free completion is at 100%.",
          "Video verification is also strong.",
        ],
        watchouts: ["Storage is 82% full."],
        nextCheckIn: "Recheck after the next 5 finalized bookings.",
      },
      {
        expectedConfidence: "medium",
        requiredSignalGroups: [
          ["operational reliability", "late completions", "cancellations"],
          ["workflow completion", "dispute-free", "video verification"],
          ["storage", "82%"],
        ],
      }
    );

    expect(result).toEqual({ passed: true, failures: [] });
  });
});
