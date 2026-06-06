import { z } from "zod";
import { runStructuredAiTask } from "./client";
import { assertVendorCoachingSummaryOutputSafe } from "./output-guards";
import { VENDOR_COACHING_SUMMARY_PROMPT_VERSION } from "./prompt-registry";
import {
  type VendorCoachingSummaryResult,
  vendorCoachingSummaryResultSchema,
} from "./schemas";

const componentMetricSchema = z.object({
  pct: z.number().min(0).max(100).nullable(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  weightPct: z.number().min(0).max(100),
});

export const vendorCoachingAssistantRequestSchema = z.object({
  vendorName: z.string().min(1).max(160),
  trustScore: z.object({
    scored: z.boolean(),
    totalScorePct: z.number().min(0).max(100).nullable(),
    explanationOverview: z.string().min(1).max(1200),
    coverageSummary: z.string().min(1).max(800),
    strongestSignals: z.array(z.string().min(1).max(240)).max(8).default([]),
    watchItems: z.array(z.string().min(1).max(240)).max(8).default([]),
    improvementHints: z.array(z.string().min(1).max(240)).max(8).default([]),
    components: z
      .object({
        workflowCompletion: componentMetricSchema,
        videoVerification: componentMetricSchema,
        disputeFree: componentMetricSchema,
        operationalReliability: componentMetricSchema,
      })
      .nullable(),
  }),
  coachingPlan: z.object({
    summary: z.string().min(1).max(800),
    priorityActions: z.array(z.string().min(1).max(240)).max(8).default([]),
    strengths: z.array(z.string().min(1).max(240)).max(8).default([]),
    operationalNotes: z.array(z.string().min(1).max(240)).max(8).default([]),
  }),
  dashboardSnapshot: z.object({
    totalBookings: z.number().int().nonnegative(),
    totalClients: z.number().int().nonnegative(),
    rating: z.number().min(0).max(5),
    ratingCount: z.number().int().nonnegative(),
    approvedVideos: z.number().int().nonnegative(),
    pendingVideos: z.number().int().nonnegative(),
    archivedVideos: z.number().int().nonnegative(),
    totalVideoAssets: z.number().int().nonnegative(),
    storagePercentUsed: z.number().min(0).max(100),
    completedJobs: z.number().int().nonnegative(),
    inProgressJobs: z.number().int().nonnegative(),
    scheduledJobs: z.number().int().nonnegative(),
    reviewCoverage: z.number().int().min(0).max(100),
  }),
});

export type VendorCoachingAssistantRequest = z.infer<
  typeof vendorCoachingAssistantRequestSchema
>;

export function buildVendorCoachingSummaryAssistantInput(
  context: VendorCoachingAssistantRequest
): string {
  const components = context.trustScore.components;

  return [
    "Reliance vendor coaching summary request.",
    "Important scope: you are summarizing deterministic Reliance Trust Score explanations, deterministic vendor coaching output, and current dashboard metrics only.",
    "Do not claim you watched videos, interviewed customers, inspected hidden moderation evidence, or changed the Trust Score.",
    "Do not invent new metrics or promise ranking, promotion, or Trust Score gains.",
    "Use concise, supportive, action-oriented language for the vendor.",
    "",
    `Vendor name: ${context.vendorName}`,
    `Trust Score scored: ${context.trustScore.scored ? "Yes" : "No"}`,
    `Trust Score total: ${
      context.trustScore.totalScorePct === null ? "Not yet measurable" : `${context.trustScore.totalScorePct}%`
    }`,
    `Trust Score overview: ${context.trustScore.explanationOverview}`,
    `Coverage summary: ${context.trustScore.coverageSummary}`,
    `Strongest signals: ${
      context.trustScore.strongestSignals.length
        ? context.trustScore.strongestSignals.join(" | ")
        : "None provided"
    }`,
    `Watch items: ${
      context.trustScore.watchItems.length
        ? context.trustScore.watchItems.join(" | ")
        : "None provided"
    }`,
    `Improvement hints: ${
      context.trustScore.improvementHints.length
        ? context.trustScore.improvementHints.join(" | ")
        : "None provided"
    }`,
    "",
    "Trust Score component metrics:",
    components
      ? [
          `Workflow completion: ${components.workflowCompletion.pct ?? "N/A"}% (${components.workflowCompletion.numerator}/${components.workflowCompletion.denominator})`,
          `Video verification: ${components.videoVerification.pct ?? "N/A"}% (${components.videoVerification.numerator}/${components.videoVerification.denominator})`,
          `Dispute-free completion: ${components.disputeFree.pct ?? "N/A"}% (${components.disputeFree.numerator}/${components.disputeFree.denominator})`,
          `Operational reliability: ${components.operationalReliability.pct ?? "N/A"}% (${components.operationalReliability.numerator}/${components.operationalReliability.denominator})`,
        ].join("\n")
      : "Component metrics unavailable.",
    "",
    `Deterministic coaching summary: ${context.coachingPlan.summary}`,
    `Priority actions: ${
      context.coachingPlan.priorityActions.length
        ? context.coachingPlan.priorityActions.join(" | ")
        : "None provided"
    }`,
    `Strengths: ${
      context.coachingPlan.strengths.length
        ? context.coachingPlan.strengths.join(" | ")
        : "None provided"
    }`,
    `Operational notes: ${
      context.coachingPlan.operationalNotes.length
        ? context.coachingPlan.operationalNotes.join(" | ")
        : "None provided"
    }`,
    "",
    "Current dashboard metrics:",
    `Total bookings: ${context.dashboardSnapshot.totalBookings}`,
    `Total clients: ${context.dashboardSnapshot.totalClients}`,
    `Rating: ${context.dashboardSnapshot.rating}`,
    `Rating count: ${context.dashboardSnapshot.ratingCount}`,
    `Approved videos: ${context.dashboardSnapshot.approvedVideos}`,
    `Pending videos: ${context.dashboardSnapshot.pendingVideos}`,
    `Archived videos: ${context.dashboardSnapshot.archivedVideos}`,
    `Total video assets: ${context.dashboardSnapshot.totalVideoAssets}`,
    `Storage percent used: ${context.dashboardSnapshot.storagePercentUsed}%`,
    `Completed jobs in current slice: ${context.dashboardSnapshot.completedJobs}`,
    `In-progress jobs in current slice: ${context.dashboardSnapshot.inProgressJobs}`,
    `Scheduled jobs in current slice: ${context.dashboardSnapshot.scheduledJobs}`,
    `Review coverage in current slice: ${context.dashboardSnapshot.reviewCoverage}%`,
  ].join("\n");
}

export const VENDOR_COACHING_SUMMARY_INSTRUCTIONS = `
You are the Reliance AI Vendor Coaching Summary Assistant.

Your job is to turn existing deterministic Reliance Trust Score explanations, deterministic vendor coaching output, and current dashboard metrics into a short vendor-facing coaching brief.

Constraints:
- You are recommendation-only.
- You do not change Trust Score math or outcomes.
- You do not have hidden evidence, customer interviews, or raw video review.
- You must stay grounded in the supplied metrics and guidance only.
- Use calm, practical language that helps the vendor know what to focus on next.
- If the inputs already point to ambiguity, avoid overconfident language.

Output requirements:
- Return valid JSON only.
- Keep the summary concise and operator-friendly.
- Priority headline should name the main coaching focus in one sentence.
- Recommended focus should be actionable, not vague encouragement.
- Positive signals should reinforce what is already working.
- Watchouts should highlight the main operational risks without sounding punitive.
- Next check-in should suggest a practical milestone like the next batch of finalized jobs or the next moderation cycle.
`.trim();

export function normalizeVendorCoachingSummaryResult(
  result: VendorCoachingSummaryResult
): VendorCoachingSummaryResult {
  if (result.confidence !== "high") {
    return result;
  }

  return {
    ...result,
    confidence: "medium",
  };
}

export async function getVendorCoachingSummarySuggestion(
  context: VendorCoachingAssistantRequest,
  actorUserId: string,
  vendorId: string
){
  const result = await runStructuredAiTask({
    feature: "vendor_coaching",
    operation: "summarize_vendor_coaching_plan",
    schema: vendorCoachingSummaryResultSchema,
    instructions: VENDOR_COACHING_SUMMARY_INSTRUCTIONS,
    input: buildVendorCoachingSummaryAssistantInput(context),
    promptVersion: VENDOR_COACHING_SUMMARY_PROMPT_VERSION,
    actorUserId,
    entityId: vendorId,
    metadata: {
      analysisScope: "vendor_self_service_summary",
      vendorId,
      vendorName: context.vendorName,
      scored: context.trustScore.scored,
      totalScorePct: context.trustScore.totalScorePct,
      totalBookings: context.dashboardSnapshot.totalBookings,
      pendingVideos: context.dashboardSnapshot.pendingVideos,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
    validateData: assertVendorCoachingSummaryOutputSafe,
  });

  return {
    ...result,
    data: normalizeVendorCoachingSummaryResult(result.data),
  };
}
