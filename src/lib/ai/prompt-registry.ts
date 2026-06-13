import type { AiFeatureKey } from "./config";

export const MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION = "media-package-metadata-v1";
export const DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION = "content-report-case-v1";
export const VENDOR_COACHING_SUMMARY_PROMPT_VERSION = "vendor-coaching-summary-v1";
export const VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION = "vendor-approval-review-v1";
export const REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION = "review-moderation-v1";
export const PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION = "publish-readiness-v1";
export const PROMOTIONS_ASSISTANT_PROMPT_VERSION = "promotion-readiness-v1";
export const VENDOR_COPY_ASSISTANT_PROMPT_VERSION = "vendor-copy-v1";
export const JOB_RECOVERY_ASSISTANT_PROMPT_VERSION = "job-recovery-v1";
export const SUPPORT_INBOX_TRIAGE_PROMPT_VERSION = "support-inbox-triage-v1";

export type AiPromptCatalogEntry = {
  feature: AiFeatureKey;
  label: string;
  operation: string;
  promptVersion: string | null;
  scope: "ai_assistant" | "deterministic";
  adminSurface: string;
  notes: string;
};

export const AI_PROMPT_CATALOG: AiPromptCatalogEntry[] = [
  {
    feature: "moderation_assistant",
    label: "Moderation Assistant",
    operation: "review_media_package",
    promptVersion: MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/media-moderation",
    notes: "Metadata-only recommendation pass for staged service-video packages.",
  },
  {
    feature: "dispute_summary_assistant",
    label: "Dispute Summary Assistant",
    operation: "summarize_content_report_case",
    promptVersion: DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/reported-content",
    notes: "Admin-only report triage summary grounded in linked booking/review/media metadata.",
  },
  {
    feature: "trust_score_explanations",
    label: "Trust Score Explanations",
    operation: "snapshot_explanation",
    promptVersion: null,
    scope: "deterministic",
    adminSurface: "/admin/vendors",
    notes: "Deterministic explanation layer only. No AI prompt is used for Trust Score math or explanations today.",
  },
  {
    feature: "vendor_coaching",
    label: "Vendor Coaching Summary",
    operation: "summarize_vendor_coaching_plan",
    promptVersion: VENDOR_COACHING_SUMMARY_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/vendor/analytics",
    notes: "Optional AI summary layered on top of deterministic Trust Score and dashboard coaching inputs.",
  },
  {
    feature: "vendor_approval_assistant",
    label: "Vendor Approval Assistant",
    operation: "review_vendor_application",
    promptVersion: VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/vendors/approval-queue",
    notes: "Admin-only recommendation layer for vendor access approval. AI suggests; admins still decide.",
  },
  {
    feature: "review_moderation_assistant",
    label: "Review Moderation Assistant",
    operation: "review_customer_review",
    promptVersion: REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/reviews",
    notes: "Admin-only recommendation layer for public vs private review moderation decisions.",
  },
  {
    feature: "publish_readiness_assistant",
    label: "Publish Readiness Assistant",
    operation: "review_vendor_publish_readiness",
    promptVersion: PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/publish-management",
    notes: "Admin-only recommendation layer for vendor listing and service publish readiness.",
  },
  {
    feature: "promotions_assistant",
    label: "Promotions Assistant",
    operation: "review_promotion_campaign_readiness",
    promptVersion: PROMOTIONS_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/promoted-listings",
    notes: "Admin-only readiness guidance for payment, visibility, and campaign activation decisions.",
  },
  {
    feature: "vendor_copy_assistant",
    label: "Vendor Copy Assistant",
    operation: "improve_vendor_copy",
    promptVersion: VENDOR_COPY_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/vendor/profile",
    notes: "Vendor-facing copy guidance for profiles and saved services grounded in existing business details.",
  },
  {
    feature: "job_recovery_assistant",
    label: "Job Recovery Assistant",
    operation: "suggest_job_recovery_steps",
    promptVersion: JOB_RECOVERY_ASSISTANT_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/vendor/jobs",
    notes: "Role-aware recovery guidance for vendor and employee job workflow confusion or blocked states.",
  },
  {
    feature: "support_inbox_triage",
    label: "Support Inbox Triage",
    operation: "triage_support_and_alert_inbox",
    promptVersion: SUPPORT_INBOX_TRIAGE_PROMPT_VERSION,
    scope: "ai_assistant",
    adminSurface: "/admin/notifications",
    notes: "Admin triage summary for current unread internal support and alert notifications.",
  },
];

export function readAiPromptCatalog(): AiPromptCatalogEntry[] {
  return AI_PROMPT_CATALOG.slice();
}
