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

export type ModerationAssistantResult = z.infer<typeof moderationAssistantResultSchema>;
export type DisputeSummaryResult = z.infer<typeof disputeSummaryResultSchema>;
export type VendorCoachingSummaryResult = z.infer<typeof vendorCoachingSummaryResultSchema>;
