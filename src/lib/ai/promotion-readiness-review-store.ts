import {
  getLatestStoredAiRecommendation,
  getLatestStoredAiRecommendations,
  persistAiRecommendationRecord,
  buildAiRecommendationFingerprint,
  type StoredAiRecommendationRecord,
} from "./recommendation-records";
import {
  getPromotionReadinessAssistantSuggestion,
  type PromotionReadinessAssistantContext,
} from "./promotion-readiness-assistant";
import { PROMOTIONS_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  promotionsAssistantResultSchema,
  type PromotionsAssistantResult,
} from "./schemas";
import { prisma } from "@/server/db";
import { withTransientDbRetry } from "@/lib/transient-db-errors";

export const PROMOTION_READINESS_AI_RESULT_ACTION = "promotion_readiness_ai_result";

export type PromotionReadinessAiStoredResult =
  StoredAiRecommendationRecord<PromotionsAssistantResult>;

function buildEligibilityNote(input: {
  vendorPubliclyListed: boolean;
  vendorAccountStatus: string | null;
  servicePublished: boolean;
  paymentStatus: string;
}) {
  const notes: string[] = [];
  if (!input.vendorPubliclyListed) notes.push("vendor is not publicly listed");
  if (String(input.vendorAccountStatus || "").toUpperCase() !== "ACTIVE") {
    notes.push("vendor account is not active");
  }
  if (!input.servicePublished) notes.push("linked service is not published");
  if (!["paid", "waived"].includes(String(input.paymentStatus || "").toLowerCase())) {
    notes.push("payment is not in a launch-ready state");
  }
  return notes.length
    ? `Campaign is blocked because ${notes.join(", ")}.`
    : "Campaign prerequisites appear satisfied from current vendor, service, and payment state.";
}

export async function resolvePromotionReadinessAssistantContext(
  campaignId: string
): Promise<PromotionReadinessAssistantContext | null> {
  const campaign = (await withTransientDbRetry(() =>
    (prisma as any).promotionCampaign.findUnique({
      where: { id: String(campaignId) },
      include: {
        vendor: {
          select: {
            businessName: true,
            name: true,
            accountStatus: true,
            isPubliclyListed: true,
          },
        },
        service: {
          select: {
            name: true,
            isPublished: true,
          },
        },
        package: {
          select: {
            name: true,
          },
        },
      },
    })
  )) as any;

  if (!campaign) return null;

  return {
    campaignId: String(campaign.id),
    campaignName: String(campaign.name || "Unnamed campaign"),
    packageName: campaign.package?.name ? String(campaign.package.name) : null,
    placementType: String(campaign.placementType || "UNKNOWN"),
    status: String(campaign.status || "draft"),
    paymentStatus: String(campaign.paymentStatus || "not_started"),
    amountDueCents: Number(campaign.amountDueCents || 0),
    vendorName:
      campaign.vendor?.businessName || campaign.vendor?.name || null,
    vendorAccountStatus: campaign.vendor?.accountStatus
      ? String(campaign.vendor.accountStatus)
      : null,
    vendorPubliclyListed: Boolean(campaign.vendor?.isPubliclyListed),
    serviceName: campaign.service?.name ? String(campaign.service.name) : null,
    servicePublished: Boolean(campaign.service?.isPublished),
    targetCity: campaign.targetCity ? String(campaign.targetCity) : null,
    targetState: campaign.targetState ? String(campaign.targetState) : null,
    targetRadiusMiles: Number(campaign.targetRadiusMiles || 0),
    eligibilityNote: buildEligibilityNote({
      vendorPubliclyListed: Boolean(campaign.vendor?.isPubliclyListed),
      vendorAccountStatus: campaign.vendor?.accountStatus
        ? String(campaign.vendor.accountStatus)
        : null,
      servicePublished: Boolean(campaign.service?.isPublished),
      paymentStatus: String(campaign.paymentStatus || "not_started"),
    }),
  };
}

function severityForPromotionDecision(
  decision: PromotionsAssistantResult["decision"]
): "info" | "warning" | "critical" {
  if (decision === "hold_for_admin_review") return "critical";
  if (decision === "needs_payment" || decision === "needs_visibility_work") {
    return "warning";
  }
  return "info";
}

export async function generatePromotionReadinessAiStoredResult(
  campaignId: string,
  actorUserId: string,
  source: string | null
): Promise<PromotionReadinessAiStoredResult | null> {
  const context = await resolvePromotionReadinessAssistantContext(campaignId);
  if (!context) return null;

  const ai = await getPromotionReadinessAssistantSuggestion(context, actorUserId);
  const storedResult: PromotionReadinessAiStoredResult = {
    aiRunId: ai.responseId,
    feature: "promotions_assistant",
    operation: "review_promotion_campaign_readiness",
    promptVersion: PROMOTIONS_ASSISTANT_PROMPT_VERSION,
    model: ai.model,
    usage: ai.usage,
    suggestion: ai.data,
    fingerprint: buildAiRecommendationFingerprint(context),
    source,
    generatedAt: new Date().toISOString(),
    actorUserId,
    queue: {
      title: `Promotion readiness: ${context.campaignName}`,
      summary: ai.data.summary,
      decision: ai.data.decision,
      confidence: ai.data.confidence,
      severity: severityForPromotionDecision(ai.data.decision),
      scope: "admin_action",
      surfaceHref: `/admin/promoted-listings`,
      relatedEntityType: "promotion_campaign",
      relatedEntityId: campaignId,
      relatedEntityLabel: context.campaignName,
      blockers: ai.data.blockingIssues,
      recommendedActions: ai.data.recommendedActions,
    },
  };

  await persistAiRecommendationRecord({
    actionType: PROMOTION_READINESS_AI_RESULT_ACTION,
    entityType: "promotion_campaign",
    entityId: campaignId,
    actorUserId,
    record: storedResult,
  });

  return storedResult;
}

export async function getLatestPromotionReadinessAiStoredResult(
  campaignId: string
): Promise<PromotionReadinessAiStoredResult | null> {
  return getLatestStoredAiRecommendation(
    PROMOTION_READINESS_AI_RESULT_ACTION,
    "promotion_campaign",
    campaignId,
    promotionsAssistantResultSchema
  );
}

export async function getLatestPromotionReadinessAiStoredResults(
  campaignIds: string[]
): Promise<Record<string, PromotionReadinessAiStoredResult>> {
  return getLatestStoredAiRecommendations(
    PROMOTION_READINESS_AI_RESULT_ACTION,
    "promotion_campaign",
    campaignIds,
    promotionsAssistantResultSchema
  );
}
