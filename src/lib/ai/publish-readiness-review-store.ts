import {
  getLatestStoredAiRecommendation,
  getLatestStoredAiRecommendations,
  persistAiRecommendationRecord,
  buildAiRecommendationFingerprint,
  type StoredAiRecommendationRecord,
} from "./recommendation-records";
import {
  getPublishReadinessAssistantSuggestion,
  type PublishReadinessAssistantContext,
} from "./publish-readiness-assistant";
import { PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  publishReadinessAssistantResultSchema,
  type PublishReadinessAssistantResult,
} from "./schemas";
import { prisma } from "@/server/db";
import { withTransientDbRetry } from "@/lib/transient-db-errors";

export const PUBLISH_READINESS_AI_RESULT_ACTION = "publish_readiness_ai_result";

export type PublishReadinessAiStoredResult =
  StoredAiRecommendationRecord<PublishReadinessAssistantResult>;

export async function resolvePublishReadinessAssistantContext(
  vendorId: string
): Promise<PublishReadinessAssistantContext | null> {
  const vendor = await withTransientDbRetry(() =>
    prisma.vendor.findUnique({
      where: { id: String(vendorId) },
      select: {
        id: true,
        businessName: true,
        name: true,
        isPubliclyListed: true,
        memberships: {
          where: { role: "MANAGER" },
          orderBy: [{ requestedAt: "desc" }],
          take: 1,
          select: {
            status: true,
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            price: true,
            description: true,
            isPublished: true,
          },
          take: 20,
          orderBy: [{ createdAt: "desc" }],
        },
        reviews: {
          where: {
            moderationStatus: "approved",
            visibilityStatus: "public",
          },
          select: { id: true },
        },
        mediaAssets: {
          where: {
            moderationStatus: "approved",
            visibilityStatus: "public",
          },
          select: { id: true },
        },
      },
    })
  );

  if (!vendor) return null;

  const publishedServiceCount = vendor.services.filter((service) => service.isPublished).length;
  const draftServiceCount = vendor.services.filter((service) => !service.isPublished).length;

  return {
    vendorId: vendor.id,
    businessName: vendor.businessName || vendor.name || "Unnamed vendor",
    membershipStatus: String(vendor.memberships[0]?.status || "UNKNOWN"),
    isPubliclyListed: Boolean(vendor.isPubliclyListed),
    publishedServiceCount,
    draftServiceCount,
    publishedReviewCount: vendor.reviews.length,
    approvedVideoCount: vendor.mediaAssets.length,
    services: vendor.services.map((service) => ({
      id: service.id,
      name: service.name,
      price: Number(service.price || 0),
      isPublished: Boolean(service.isPublished),
      hasDescription: Boolean(String(service.description || "").trim()),
    })),
  };
}

function severityForPublishDecision(
  decision: PublishReadinessAssistantResult["decision"]
): "info" | "warning" | "critical" {
  if (decision === "needs_admin_follow_up") return "critical";
  if (decision === "needs_vendor_action") return "warning";
  return "info";
}

export async function generatePublishReadinessAiStoredResult(
  vendorId: string,
  actorUserId: string,
  source: string | null
): Promise<PublishReadinessAiStoredResult | null> {
  const context = await resolvePublishReadinessAssistantContext(vendorId);
  if (!context) return null;

  const ai = await getPublishReadinessAssistantSuggestion(context, actorUserId);
  const storedResult: PublishReadinessAiStoredResult = {
    aiRunId: ai.responseId,
    feature: "publish_readiness_assistant",
    operation: "review_vendor_publish_readiness",
    promptVersion: PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION,
    model: ai.model,
    usage: ai.usage,
    suggestion: ai.data,
    fingerprint: buildAiRecommendationFingerprint(context),
    source,
    generatedAt: new Date().toISOString(),
    actorUserId,
    queue: {
      title: `Publish readiness: ${context.businessName}`,
      summary: ai.data.summary,
      decision: ai.data.decision,
      confidence: ai.data.confidence,
      severity: severityForPublishDecision(ai.data.decision),
      scope: "admin_action",
      surfaceHref: `/admin/publish-management?q=${encodeURIComponent(context.businessName)}`,
      relatedEntityType: "vendor",
      relatedEntityId: vendorId,
      relatedEntityLabel: context.businessName,
      blockers: ai.data.blockingIssues,
      recommendedActions: ai.data.recommendedActions,
    },
  };

  await persistAiRecommendationRecord({
    actionType: PUBLISH_READINESS_AI_RESULT_ACTION,
    entityType: "vendor",
    entityId: vendorId,
    actorUserId,
    record: storedResult,
  });

  return storedResult;
}

export async function getLatestPublishReadinessAiStoredResult(
  vendorId: string
): Promise<PublishReadinessAiStoredResult | null> {
  return getLatestStoredAiRecommendation(
    PUBLISH_READINESS_AI_RESULT_ACTION,
    "vendor",
    vendorId,
    publishReadinessAssistantResultSchema
  );
}

export async function getLatestPublishReadinessAiStoredResults(
  vendorIds: string[]
): Promise<Record<string, PublishReadinessAiStoredResult>> {
  return getLatestStoredAiRecommendations(
    PUBLISH_READINESS_AI_RESULT_ACTION,
    "vendor",
    vendorIds,
    publishReadinessAssistantResultSchema
  );
}
