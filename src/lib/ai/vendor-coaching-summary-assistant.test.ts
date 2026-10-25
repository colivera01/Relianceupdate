import { describe, expect, it } from "vitest";
import {
  buildVendorCoachingSummaryAssistantInput,
  normalizeVendorCoachingSummaryResult,
} from "./vendor-coaching-summary-assistant";
import { VENDOR_COACHING_SUMMARY_PROMPT_VERSION } from "./prompt-registry";

describe("vendor coaching summary assistant", () => {
  it("builds a grounded vendor coaching input", () => {
    const input = buildVendorCoachingSummaryAssistantInput({
      vendorName: "Metro Home Care Pros",
      trustScore: {
        scored: true,
        totalScorePct: 98,
        explanationOverview: "Workflow and dispute-free outcomes are strong.",
        coverageSummary: "Coverage comes from 23 finalized workflows.",
        strongestSignals: ["Verified workflow completion is perfect."],
        watchItems: ["Video verification is the main opportunity."],
        improvementHints: ["Improve staged-video capture quality."],
        components: {
          workflowCompletion: { pct: 100, numerator: 23, denominator: 23, weightPct: 35 },
          videoVerification: { pct: 86.96, numerator: 20, denominator: 23, weightPct: 30 },
          disputeFree: { pct: 100, numerator: 23, denominator: 23, weightPct: 35 },
          operationalReliability: { pct: null, numerator: 0, denominator: 0, weightPct: 0 },
        },
      },
      coachingPlan: {
        summary: "Video verification is the clearest reliability opportunity.",
        priorityActions: ["Improve staged-video capture quality."],
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
    });

    expect(VENDOR_COACHING_SUMMARY_PROMPT_VERSION).toBe("vendor-coaching-summary-v2");
    expect(input).toContain("deterministic Reliance Trust Score verified-reliability explanations");
    expect(input).toContain("Do not invent new metrics");
    expect(input).toContain("Vendor name: Metro Home Care Pros");
    expect(input).toContain("Reliability score total: 98/100");
    expect(input).toContain("Video verification: 86.96%");
    expect(input).not.toContain("Operational reliability:");
    expect(input).toContain("Storage percent used: 82%");
  });

  it("caps overconfident coaching summaries to medium", () => {
    const normalized = normalizeVendorCoachingSummaryResult({
      summary: "Your next focus should be operational reliability cleanup.",
      confidence: "high",
      priorityHeadline: "Tighten operational reliability first.",
      recommendedFocus: ["Review cancellations."],
      positiveSignals: ["Workflow completion is perfect."],
      watchouts: ["Storage usage is high."],
      nextCheckIn: "Recheck after the next 5 finalized bookings.",
    });

    expect(normalized.confidence).toBe("medium");
  });
});
