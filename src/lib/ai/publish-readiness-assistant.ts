import { runStructuredAiTask } from "./client";
import { PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  publishReadinessAssistantResultSchema,
  type PublishReadinessAssistantResult,
} from "./schemas";

export type PublishReadinessServiceSummary = {
  id: string;
  name: string;
  price: number;
  isPublished: boolean;
  hasDescription: boolean;
};

export type PublishReadinessAssistantContext = {
  vendorId: string;
  businessName: string;
  membershipStatus: string;
  isPubliclyListed: boolean;
  publishedServiceCount: number;
  draftServiceCount: number;
  publishedReviewCount: number;
  approvedVideoCount: number;
  services: PublishReadinessServiceSummary[];
};

function buildInput(context: PublishReadinessAssistantContext): string {
  return [
    "Reliance publish readiness review request.",
    "Important scope: this is a recommendation-only review for public vendor listing and service publishing readiness.",
    "Do not confuse vendor access approval with public listing. Do not change business rules.",
    "",
    `Vendor ID: ${context.vendorId}`,
    `Business name: ${context.businessName}`,
    `Membership status: ${context.membershipStatus}`,
    `Vendor publicly listed: ${context.isPubliclyListed ? "Yes" : "No"}`,
    `Published services: ${context.publishedServiceCount}`,
    `Draft or unpublished services: ${context.draftServiceCount}`,
    `Published reviews: ${context.publishedReviewCount}`,
    `Approved public service videos: ${context.approvedVideoCount}`,
    "Service summaries:",
    context.services.length
      ? context.services
          .slice(0, 10)
          .map(
            (service) =>
              `- ${service.name} | $${service.price.toFixed(2)} | published=${service.isPublished ? "yes" : "no"} | description=${service.hasDescription ? "present" : "missing"}`
          )
          .join("\n")
      : "- No services found",
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Publish Readiness Assistant.

Your job is to help admin understand whether a vendor is ready for the next public visibility step.

Constraints:
- Recommendation only. Admin still controls public listing and service publishing.
- Treat vendor access approval, vendor public listing, and service publishing as separate states.
- If vendor access is not active, that should usually block public listing readiness.
- Lack of reviews or videos does not automatically block publication, but it can reduce public confidence. Explain that without inventing hard rules.
- Focus on the next most logical publish step, not an ideal future state.

Output requirements:
- Return valid JSON only.
- Scope notes should clarify whether the recommendation is about vendor listing, service publishing, or vendor cleanup first.
`.trim();

export async function getPublishReadinessAssistantSuggestion(
  context: PublishReadinessAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "publish_readiness_assistant",
    operation: "review_vendor_publish_readiness",
    schema: publishReadinessAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.vendorId,
    metadata: {
      analysisScope: "publish_readiness",
      vendorId: context.vendorId,
      membershipStatus: context.membershipStatus,
      isPubliclyListed: context.isPubliclyListed,
      publishedServiceCount: context.publishedServiceCount,
      draftServiceCount: context.draftServiceCount,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizePublishReadinessAssistantResult(result.data),
  };
}

function normalizePublishReadinessAssistantResult(
  result: PublishReadinessAssistantResult
): PublishReadinessAssistantResult {
  if (
    result.decision === "ready_to_list_vendor" &&
    result.confidence === "high"
  ) {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
