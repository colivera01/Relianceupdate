import { runStructuredAiTask } from "./client";
import { REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  reviewModerationAssistantResultSchema,
  type ReviewModerationAssistantResult,
} from "./schemas";

export type ReviewModerationAssistantContext = {
  reviewId: string;
  vendorId: string;
  vendorName: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  clientName: string | null;
  jobType: string | null;
  rating: number;
  comment: string;
  createdAt: string | null;
  moderationStatus: string;
  visibilityStatus: string;
  moderationReason: string | null;
};

function buildInput(context: ReviewModerationAssistantContext): string {
  return [
    "Reliance review moderation request.",
    "Important scope: this is a recommendation-only moderation review for a customer review.",
    "Do not claim hidden evidence, off-platform verification, or policy authority beyond the supplied review record.",
    "Keep customer reviews separate from Trust Score. This decision only affects review visibility and moderation state.",
    "",
    `Review ID: ${context.reviewId}`,
    `Vendor ID: ${context.vendorId}`,
    `Vendor name: ${context.vendorName || "Unknown vendor"}`,
    `Reviewer name: ${context.reviewerName || context.clientName || "Unknown reviewer"}`,
    `Reviewer email: ${context.reviewerEmail || "Not provided"}`,
    `Job type: ${context.jobType || "Unknown"}`,
    `Rating: ${context.rating}/5`,
    `Created at: ${context.createdAt || "Unknown"}`,
    `Current moderation status: ${context.moderationStatus}`,
    `Current visibility status: ${context.visibilityStatus}`,
    `Existing moderation reason: ${context.moderationReason || "None"}`,
    `Review comment: ${context.comment || "No comment provided."}`,
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Review Moderation Assistant.

Your job is to recommend the safest, clearest next moderation action for a customer review using only the supplied review metadata and text.

Constraints:
- Recommendation only. Admins still decide.
- Do not mention Trust Score math or vendor ranking.
- Avoid legal language unless the supplied text clearly raises safety, fraud, abuse, or harassment concerns.
- If the review seems acceptable but weak, neutral, or sparse, prefer an approval path instead of over-escalation.
- "approve_vendor_private" is appropriate when the review can be retained internally without being a strong public trust signal yet.

Output requirements:
- Return valid JSON only.
- Suggested moderation reason should be empty unless a reject, flag, or private-only choice truly needs explanation.
- Customer trust note should explain the customer-facing impact in one short sentence.
`.trim();

export async function getReviewModerationAssistantSuggestion(
  context: ReviewModerationAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "review_moderation_assistant",
    operation: "review_customer_review",
    schema: reviewModerationAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.reviewId,
    metadata: {
      analysisScope: "review_moderation",
      reviewId: context.reviewId,
      vendorId: context.vendorId,
      rating: context.rating,
      moderationStatus: context.moderationStatus,
      visibilityStatus: context.visibilityStatus,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizeReviewModerationAssistantResult(result.data),
  };
}

export function normalizeReviewModerationAssistantResult(
  result: ReviewModerationAssistantResult
): ReviewModerationAssistantResult {
  if (result.decision === "approve_public" && result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
