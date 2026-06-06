import { createAdminAuditLog } from "@/lib/admin-audit";
import type { AiFeatureKey } from "./config";

export type AiOperatorFeedbackOutcome = "accepted" | "overrode" | "ignored";

export type AiOperatorFeedbackSource =
  | "admin_media_moderation"
  | "admin_reported_content";

export type LogAiOperatorFeedbackInput = {
  aiRunId: string;
  actorUserId: string;
  feature: AiFeatureKey;
  operation: string;
  relatedEntityType: "booking" | "content_report";
  relatedEntityId: string;
  outcome: AiOperatorFeedbackOutcome;
  source: AiOperatorFeedbackSource;
  promptVersion?: string | null;
  model?: string | null;
  recommendedAction?: string | null;
  actualAction?: string | null;
  notes?: string | null;
};

function cleanText(value: string | null | undefined): string | null {
  const next = String(value || "").trim();
  return next ? next : null;
}

export function isAiOperatorFeedbackOutcome(value: unknown): value is AiOperatorFeedbackOutcome {
  return value === "accepted" || value === "overrode" || value === "ignored";
}

export function moderationDecisionToRecommendedAction(
  decision: "approve" | "flag" | "reject" | "needs_human_review"
): string {
  if (decision === "approve") return "approve";
  if (decision === "flag") return "flag";
  if (decision === "reject") return "reject";
  return "needs_human_review";
}

export function moderationActionToActionFamily(
  action:
    | "approve"
    | "reject"
    | "flag"
    | "approve_public"
    | "approve_customer_only"
    | "approve_vendor_archive_only"
    | "approve_private"
    | "set_visibility_public"
    | "set_visibility_customer_only"
    | "set_visibility_vendor_archive_only"
    | "set_visibility_private"
): "approve" | "reject" | "flag" {
  if (action === "reject") return "reject";
  if (action === "flag") return "flag";
  return "approve";
}

export function inferModerationFeedbackOutcome(
  decision: "approve" | "flag" | "reject" | "needs_human_review",
  action:
    | "approve"
    | "reject"
    | "flag"
    | "approve_public"
    | "approve_customer_only"
    | "approve_vendor_archive_only"
    | "approve_private"
    | "set_visibility_public"
    | "set_visibility_customer_only"
    | "set_visibility_vendor_archive_only"
    | "set_visibility_private"
): AiOperatorFeedbackOutcome {
  const actionFamily = moderationActionToActionFamily(action);

  if (decision === "needs_human_review") {
    return actionFamily === "approve" ? "overrode" : "accepted";
  }

  return moderationDecisionToRecommendedAction(decision) === actionFamily
    ? "accepted"
    : "overrode";
}

export async function logAiOperatorFeedback(
  input: LogAiOperatorFeedbackInput
): Promise<void> {
  const aiRunId = cleanText(input.aiRunId);
  const actorUserId = cleanText(input.actorUserId);
  const relatedEntityId = cleanText(input.relatedEntityId);

  if (!aiRunId || !actorUserId || !relatedEntityId) {
    throw new Error("aiRunId, actorUserId, and relatedEntityId are required");
  }

  await createAdminAuditLog({
    actionType: "ai_feedback",
    entityType: "ai_run",
    entityId: aiRunId,
    actorUserId,
    metadata: {
      feature: input.feature,
      operation: cleanText(input.operation),
      relatedEntityType: input.relatedEntityType,
      relatedEntityId,
      outcome: input.outcome,
      source: input.source,
      promptVersion: cleanText(input.promptVersion),
      model: cleanText(input.model),
      recommendedAction: cleanText(input.recommendedAction),
      actualAction: cleanText(input.actualAction),
      notes: cleanText(input.notes),
    },
  });
}
