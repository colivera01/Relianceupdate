import type { AiFeatureKey } from "./config";

export const MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION = "media-package-metadata-v1";
export const DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION = "content-report-case-v1";
export const VENDOR_COACHING_SUMMARY_PROMPT_VERSION = "vendor-coaching-summary-v1";

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
];

export function readAiPromptCatalog(): AiPromptCatalogEntry[] {
  return AI_PROMPT_CATALOG.slice();
}
