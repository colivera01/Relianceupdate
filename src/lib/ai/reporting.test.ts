import { describe, expect, it } from "vitest";
import {
  buildAiActivityReport,
  formatAiFeatureLabel,
  normalizeAiActivityFeatureFilter,
  serializeAiRecentRunsCsv,
} from "./reporting";

describe("formatAiFeatureLabel", () => {
  it("maps known AI features to friendly labels", () => {
    expect(formatAiFeatureLabel("moderation_assistant")).toBe("Moderation Assistant");
    expect(formatAiFeatureLabel("vendor_coaching")).toBe("Vendor Coaching");
    expect(formatAiFeatureLabel("vendor_approval_assistant")).toBe("Vendor Approval Assistant");
    expect(formatAiFeatureLabel("support_inbox_triage")).toBe("Support Inbox Triage");
    expect(formatAiFeatureLabel("something_else")).toBe("Unknown Feature");
  });
});

describe("normalizeAiActivityFeatureFilter", () => {
  it("keeps valid feature filters and falls back invalid values to all", () => {
    expect(normalizeAiActivityFeatureFilter("moderation_assistant")).toBe(
      "moderation_assistant"
    );
    expect(normalizeAiActivityFeatureFilter("publish_readiness_assistant")).toBe(
      "publish_readiness_assistant"
    );
    expect(normalizeAiActivityFeatureFilter("all")).toBe("all");
    expect(normalizeAiActivityFeatureFilter("not-real")).toBe("all");
  });
});

describe("buildAiActivityReport", () => {
  it("aggregates response, error, and feedback logs into reporting metrics", () => {
    const report = buildAiActivityReport({
      responseLogs: [
        {
          id: "log_1",
          actionType: "ai_response",
          entityId: "booking_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T13:00:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            operation: "review_package",
            responseId: "resp_1",
            model: "gpt-5.4-mini",
            promptVersion: "moderation-v1",
            durationMs: 812,
            usage: { totalTokens: 221 },
          }),
        },
        {
          id: "log_2",
          actionType: "ai_response",
          entityId: "report_1",
          actorUserId: "admin_2",
          createdAt: "2026-06-02T12:30:00.000Z",
          metadata: JSON.stringify({
            feature: "dispute_summary_assistant",
            operation: "summarize_report",
            responseId: "resp_2",
            model: "gpt-5.4-mini",
            promptVersion: "dispute-v1",
            durationMs: 1200,
            usage: { totalTokens: 300 },
          }),
        },
      ],
      feedbackLogs: [
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
        {
          id: "feedback_2",
          actionType: "ai_feedback",
          entityId: "resp_2",
          actorUserId: "admin_2",
          createdAt: "2026-06-02T12:35:00.000Z",
          metadata: JSON.stringify({
            feature: "dispute_summary_assistant",
            outcome: "overrode",
          }),
        },
      ],
      errorLogs: [
        {
          id: "error_1",
          actionType: "ai_error",
          entityId: "booking_2",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T11:00:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
          }),
        },
      ],
    });

    expect(report.responseCount).toBe(2);
    expect(report.errorCount).toBe(1);
    expect(report.feedbackCount).toBe(2);
    expect(report.acceptedCount).toBe(1);
    expect(report.overrodeCount).toBe(1);
    expect(report.ignoredCount).toBe(0);
    expect(report.feedbackCoveragePct).toBe(100);
    expect(report.followRatePct).toBe(50);
    expect(report.recentRuns[0]?.aiRunId).toBe("resp_1");
    expect(report.recentRuns[0]?.feedbackOutcome).toBe("accepted");

    const moderationSummary = report.featureSummaries.find(
      (summary) => summary.feature === "moderation_assistant"
    );
    expect(moderationSummary).toMatchObject({
      responseCount: 1,
      errorCount: 1,
      feedbackCount: 1,
      acceptedCount: 1,
      overrodeCount: 0,
      followRatePct: 100,
    });

    const disputeSummary = report.featureSummaries.find(
      (summary) => summary.feature === "dispute_summary_assistant"
    );
    expect(disputeSummary).toMatchObject({
      responseCount: 1,
      errorCount: 0,
      feedbackCount: 1,
      acceptedCount: 0,
      overrodeCount: 1,
      followRatePct: 0,
    });
  });

  it("ignores malformed metadata and invalid feedback outcomes safely", () => {
    const report = buildAiActivityReport({
      responseLogs: [
        {
          id: "log_1",
          actionType: "ai_response",
          entityId: "entity_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T10:00:00.000Z",
          metadata: "{not-json",
        },
      ],
      feedbackLogs: [
        {
          id: "feedback_1",
          actionType: "ai_feedback",
          entityId: "run_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T10:05:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            outcome: "maybe",
          }),
        },
      ],
      errorLogs: [],
    });

    expect(report.responseCount).toBe(1);
    expect(report.feedbackCount).toBe(0);
    expect(report.featureSummaries[0]).toMatchObject({
      feature: "unknown",
      responseCount: 1,
    });
    expect(report.recentRuns[0]?.feature).toBe("unknown");
  });

  it("supports filtering the report to a single AI feature", () => {
    const report = buildAiActivityReport({
      featureFilter: "moderation_assistant",
      responseLogs: [
        {
          id: "log_1",
          actionType: "ai_response",
          entityId: "booking_1",
          actorUserId: "admin_1",
          createdAt: "2026-06-02T13:00:00.000Z",
          metadata: JSON.stringify({
            feature: "moderation_assistant",
            operation: "review_package",
            responseId: "resp_1",
          }),
        },
        {
          id: "log_2",
          actionType: "ai_response",
          entityId: "report_1",
          actorUserId: "admin_2",
          createdAt: "2026-06-02T12:30:00.000Z",
          metadata: JSON.stringify({
            feature: "dispute_summary_assistant",
            operation: "summarize_report",
            responseId: "resp_2",
          }),
        },
      ],
      feedbackLogs: [
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
        {
          id: "feedback_2",
          actionType: "ai_feedback",
          entityId: "resp_2",
          actorUserId: "admin_2",
          createdAt: "2026-06-02T12:35:00.000Z",
          metadata: JSON.stringify({
            feature: "dispute_summary_assistant",
            outcome: "overrode",
          }),
        },
      ],
      errorLogs: [],
    });

    expect(report.responseCount).toBe(1);
    expect(report.feedbackCount).toBe(1);
    expect(report.featureSummaries).toHaveLength(1);
    expect(report.featureSummaries[0]?.feature).toBe("moderation_assistant");
    expect(report.recentRuns).toHaveLength(1);
    expect(report.recentRuns[0]?.feature).toBe("moderation_assistant");
  });
});

describe("serializeAiRecentRunsCsv", () => {
  it("serializes recent runs into CSV output", () => {
    const csv = serializeAiRecentRunsCsv([
      {
        aiRunId: "resp_1",
        feature: "moderation_assistant",
        featureLabel: "Moderation Assistant",
        operation: "review_media_package",
        model: "gpt-5.4-mini",
        promptVersion: "moderation-v1",
        actorUserId: "admin_1",
        relatedEntityId: "booking_1",
        createdAt: "2026-06-02T13:00:00.000Z",
        durationMs: 812,
        totalTokens: 221,
        feedbackOutcome: "accepted",
        feedbackRecordedAt: "2026-06-02T13:05:00.000Z",
      },
    ]);

    expect(csv).toContain("aiRunId,feature,featureLabel");
    expect(csv).toContain("resp_1,moderation_assistant,Moderation Assistant");
    expect(csv).toContain("accepted");
  });
});
