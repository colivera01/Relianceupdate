import {
  getLatestStoredAiRecommendation,
  getLatestStoredAiRecommendations,
  persistAiRecommendationRecord,
  buildAiRecommendationFingerprint,
  type StoredAiRecommendationRecord,
} from "./recommendation-records";
import {
  getReviewModerationAssistantSuggestion,
  type ReviewModerationAssistantContext,
} from "./review-moderation-assistant";
import { REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  reviewModerationAssistantResultSchema,
  type ReviewModerationAssistantResult,
} from "./schemas";
import { prisma } from "@/server/db";
import { withTransientDbRetry } from "@/lib/transient-db-errors";

export const REVIEW_MODERATION_AI_RESULT_ACTION = "review_moderation_ai_result";

export type ReviewModerationAiStoredResult =
  StoredAiRecommendationRecord<ReviewModerationAssistantResult>;

export async function resolveReviewModerationAssistantContext(
  reviewId: string
): Promise<ReviewModerationAssistantContext | null> {
  const review = await withTransientDbRetry(() =>
    prisma.review.findUnique({
      where: { id: String(reviewId) },
      select: {
        id: true,
        vendorId: true,
        clientName: true,
        jobType: true,
        rating: true,
        comment: true,
        createdAt: true,
        moderationStatus: true,
        visibilityStatus: true,
        moderationReason: true,
        vendor: {
          select: {
            name: true,
            businessName: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })
  );

  if (!review) return null;

  return {
    reviewId: review.id,
    vendorId: review.vendorId,
    vendorName: review.vendor?.businessName || review.vendor?.name || null,
    reviewerName: review.user?.name || review.clientName || null,
    reviewerEmail: review.user?.email || null,
    clientName: review.clientName || null,
    jobType: review.jobType || null,
    rating: Number(review.rating || 0),
    comment: review.comment || "",
    createdAt: review.createdAt?.toISOString?.() || null,
    moderationStatus: String(review.moderationStatus || "pending_review"),
    visibilityStatus: String(review.visibilityStatus || "private"),
    moderationReason: review.moderationReason || null,
  };
}

function buildQueueDecisionSeverity(
  decision: ReviewModerationAssistantResult["decision"]
): "info" | "warning" | "critical" {
  if (decision === "reject" || decision === "flag") return "critical";
  if (decision === "approve_vendor_private" || decision === "needs_manual_review") {
    return "warning";
  }
  return "info";
}

export async function generateReviewModerationAiStoredResult(
  reviewId: string,
  actorUserId: string,
  source: string | null
): Promise<ReviewModerationAiStoredResult | null> {
  const context = await resolveReviewModerationAssistantContext(reviewId);
  if (!context) return null;

  const ai = await getReviewModerationAssistantSuggestion(context, actorUserId);
  const businessLabel = context.vendorName || `Review ${reviewId}`;
  const storedResult: ReviewModerationAiStoredResult = {
    aiRunId: ai.responseId,
    feature: "review_moderation_assistant",
    operation: "review_customer_review",
    promptVersion: REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION,
    model: ai.model,
    usage: ai.usage,
    suggestion: ai.data,
    fingerprint: buildAiRecommendationFingerprint(context),
    source,
    generatedAt: new Date().toISOString(),
    actorUserId,
    queue: {
      title: `Review moderation: ${businessLabel}`,
      summary: ai.data.summary,
      decision: ai.data.decision,
      confidence: ai.data.confidence,
      severity: buildQueueDecisionSeverity(ai.data.decision),
      scope: "admin_action",
      surfaceHref: `/admin/reviews?q=${encodeURIComponent(reviewId)}`,
      relatedEntityType: "review",
      relatedEntityId: reviewId,
      relatedEntityLabel: businessLabel,
      blockers: ai.data.blockingIssues,
      recommendedActions: ai.data.recommendedActions,
    },
  };

  await persistAiRecommendationRecord({
    actionType: REVIEW_MODERATION_AI_RESULT_ACTION,
    entityType: "review",
    entityId: reviewId,
    actorUserId,
    record: storedResult,
  });

  return storedResult;
}

export async function getLatestReviewModerationAiStoredResult(
  reviewId: string
): Promise<ReviewModerationAiStoredResult | null> {
  return getLatestStoredAiRecommendation(
    REVIEW_MODERATION_AI_RESULT_ACTION,
    "review",
    reviewId,
    reviewModerationAssistantResultSchema
  );
}

export async function getLatestReviewModerationAiStoredResults(
  reviewIds: string[]
): Promise<Record<string, ReviewModerationAiStoredResult>> {
  return getLatestStoredAiRecommendations(
    REVIEW_MODERATION_AI_RESULT_ACTION,
    "review",
    reviewIds,
    reviewModerationAssistantResultSchema
  );
}
