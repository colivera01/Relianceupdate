import { runStructuredAiTask } from "./client";
import { PROMOTIONS_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  promotionsAssistantResultSchema,
  type PromotionsAssistantResult,
} from "./schemas";

export type PromotionReadinessAssistantContext = {
  campaignId: string;
  campaignName: string;
  packageName: string | null;
  placementType: string;
  status: string;
  paymentStatus: string;
  amountDueCents: number;
  vendorName: string | null;
  vendorAccountStatus: string | null;
  vendorPubliclyListed: boolean;
  serviceName: string | null;
  servicePublished: boolean;
  targetCity: string | null;
  targetState: string | null;
  targetRadiusMiles: number;
  eligibilityNote: string;
};

function buildInput(context: PromotionReadinessAssistantContext): string {
  return [
    "Reliance promotion campaign readiness review request.",
    "Important scope: this is a recommendation-only review for campaign activation and visibility readiness.",
    "Do not promise traffic, ranking, or bookings.",
    "",
    `Campaign ID: ${context.campaignId}`,
    `Campaign name: ${context.campaignName}`,
    `Package: ${context.packageName || "Unknown package"}`,
    `Placement type: ${context.placementType}`,
    `Campaign status: ${context.status}`,
    `Payment status: ${context.paymentStatus}`,
    `Amount due: $${(context.amountDueCents / 100).toFixed(2)}`,
    `Vendor name: ${context.vendorName || "Unknown vendor"}`,
    `Vendor account status: ${context.vendorAccountStatus || "Unknown"}`,
    `Vendor publicly listed: ${context.vendorPubliclyListed ? "Yes" : "No"}`,
    `Service: ${context.serviceName || "Unknown service"}`,
    `Service published: ${context.servicePublished ? "Yes" : "No"}`,
    `Target zone: ${context.targetCity || "Unknown city"}, ${context.targetState || "Unknown state"} within ${context.targetRadiusMiles} miles`,
    `Eligibility note: ${context.eligibilityNote}`,
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Promotions Assistant.

Your job is to help admin quickly understand whether a featured proof placement is ready to activate, still blocked by payment, or still blocked by visibility prerequisites.

Constraints:
- Recommendation only. Admin keeps final control.
- Do not invent campaign policy rules beyond the supplied eligibility note and state.
- Payment readiness and public proof visibility readiness are separate concepts. Explain which one is blocking progress.
- If the vendor or service is not public, call that out plainly before talking about campaign quality.

Output requirements:
- Return valid JSON only.
- Impact notes should explain the customer-facing visibility effect in short, concrete language.
`.trim();

export async function getPromotionReadinessAssistantSuggestion(
  context: PromotionReadinessAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "promotions_assistant",
    operation: "review_promotion_campaign_readiness",
    schema: promotionsAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: PROMOTIONS_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.campaignId,
    metadata: {
      analysisScope: "promotion_readiness",
      campaignId: context.campaignId,
      status: context.status,
      paymentStatus: context.paymentStatus,
      vendorPubliclyListed: context.vendorPubliclyListed,
      servicePublished: context.servicePublished,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizePromotionReadinessAssistantResult(result.data),
  };
}

function normalizePromotionReadinessAssistantResult(
  result: PromotionsAssistantResult
): PromotionsAssistantResult {
  if (result.decision === "ready_to_activate" && result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
