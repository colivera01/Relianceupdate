import { z } from "zod";

export const aiConfidenceSchema = z.enum(["low", "medium", "high"]);

export const aiFindingSchema = z.object({
  label: z.string().min(1).max(120),
  detail: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(280)).max(5).default([]),
});

export const moderationAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1000),
  decision: z.enum(["approve", "flag", "reject", "needs_human_review"]),
  confidence: aiConfidenceSchema,
  policyAreas: z.array(z.string().min(1).max(80)).max(8).default([]),
  findings: z.array(aiFindingSchema).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(180)).max(6).default([]),
});

export const disputeSummaryResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  disputeType: z.enum([
    "delivery_or_completion",
    "video_or_verification",
    "billing_or_refund",
    "conduct_or_safety",
    "other",
  ]),
  confidence: aiConfidenceSchema,
  timeline: z.array(z.string().min(1).max(280)).max(8).default([]),
  disputedPoints: z.array(z.string().min(1).max(240)).max(8).default([]),
  recommendedNextStep: z.enum([
    "close_no_action",
    "needs_vendor_follow_up",
    "needs_customer_follow_up",
    "needs_admin_review",
  ]),
  riskFlags: z.array(z.string().min(1).max(80)).max(8).default([]),
});

export const vendorCoachingSummaryResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  confidence: aiConfidenceSchema,
  priorityHeadline: z.string().min(1).max(240),
  recommendedFocus: z.array(z.string().min(1).max(220)).max(5).default([]),
  positiveSignals: z.array(z.string().min(1).max(220)).max(5).default([]),
  watchouts: z.array(z.string().min(1).max(220)).max(5).default([]),
  nextCheckIn: z.string().min(1).max(220),
});

export const vendorApprovalAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  decision: z.enum(["recommend_approve", "needs_manual_review", "recommend_reject"]),
  confidence: aiConfidenceSchema,
  findings: z.array(aiFindingSchema).max(6).default([]),
  blockingIssues: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
  scopeNotes: z.array(z.string().min(1).max(220)).max(4).default([]),
});

export const reviewModerationAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  decision: z.enum([
    "approve_public",
    "approve_vendor_private",
    "flag",
    "reject",
    "needs_manual_review",
  ]),
  confidence: aiConfidenceSchema,
  findings: z.array(aiFindingSchema).max(6).default([]),
  blockingIssues: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
  customerTrustNote: z.string().min(1).max(240),
  suggestedModerationReason: z.string().max(240).nullable().default(null),
});

export const publishReadinessAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  decision: z.enum([
    "ready_to_list_vendor",
    "ready_to_publish_service",
    "needs_vendor_action",
    "needs_admin_follow_up",
  ]),
  confidence: aiConfidenceSchema,
  findings: z.array(aiFindingSchema).max(6).default([]),
  blockingIssues: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
  scopeNotes: z.array(z.string().min(1).max(220)).max(4).default([]),
});

export const promotionsAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  decision: z.enum([
    "ready_to_activate",
    "needs_payment",
    "needs_visibility_work",
    "hold_for_admin_review",
  ]),
  confidence: aiConfidenceSchema,
  findings: z.array(aiFindingSchema).max(6).default([]),
  blockingIssues: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
  impactNotes: z.array(z.string().min(1).max(220)).max(4).default([]),
});

export const vendorCopyAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1000),
  confidence: aiConfidenceSchema,
  recommendedHeadline: z.string().min(1).max(180),
  recommendedDescription: z.string().min(1).max(900),
  recommendedBullets: z.array(z.string().min(1).max(180)).max(5).default([]),
  trustGaps: z.array(z.string().min(1).max(220)).max(5).default([]),
  riskyClaims: z.array(z.string().min(1).max(220)).max(5).default([]),
  nextEdits: z.array(z.string().min(1).max(220)).max(5).default([]),
});

export const jobRecoveryAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1000),
  decision: z.enum([
    "continue_current_step",
    "retry_step",
    "needs_vendor_follow_up",
    "needs_manager_review",
    "needs_admin_help",
  ]),
  confidence: aiConfidenceSchema,
  blockers: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
  explainWhy: z.array(z.string().min(1).max(220)).max(5).default([]),
});

export const supportInboxTriageAssistantResultSchema = z.object({
  summary: z.string().min(1).max(1200),
  confidence: aiConfidenceSchema,
  urgentItems: z.array(z.string().min(1).max(240)).max(6).default([]),
  soonItems: z.array(z.string().min(1).max(240)).max(6).default([]),
  batchLaterItems: z.array(z.string().min(1).max(240)).max(6).default([]),
  redFlags: z.array(z.string().min(1).max(220)).max(6).default([]),
  recommendedActions: z.array(z.string().min(1).max(220)).max(6).default([]),
});

export type ModerationAssistantResult = z.infer<typeof moderationAssistantResultSchema>;
export type DisputeSummaryResult = z.infer<typeof disputeSummaryResultSchema>;
export type VendorCoachingSummaryResult = z.infer<typeof vendorCoachingSummaryResultSchema>;
export type VendorApprovalAssistantResult = z.infer<typeof vendorApprovalAssistantResultSchema>;
export type ReviewModerationAssistantResult = z.infer<typeof reviewModerationAssistantResultSchema>;
export type PublishReadinessAssistantResult = z.infer<typeof publishReadinessAssistantResultSchema>;
export type PromotionsAssistantResult = z.infer<typeof promotionsAssistantResultSchema>;
export type VendorCopyAssistantResult = z.infer<typeof vendorCopyAssistantResultSchema>;
export type JobRecoveryAssistantResult = z.infer<typeof jobRecoveryAssistantResultSchema>;
export type SupportInboxTriageAssistantResult = z.infer<typeof supportInboxTriageAssistantResultSchema>;
