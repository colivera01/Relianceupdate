import { prisma } from "@/server/db";
import { launchExcludedUserIds, launchExcludedVendorIds } from "@/lib/internal-identities";
import { withTransientDbRetry } from "@/lib/transient-db-errors";
import {
  buildAiRecommendationFingerprint,
  getLatestStoredAiRecommendation,
  persistAiRecommendationRecord,
  type StoredAiRecommendationRecord,
} from "./recommendation-records";
import {
  getSupportInboxTriageAssistantSuggestion,
  type SupportInboxTriageAssistantContext,
} from "./support-inbox-triage-assistant";
import { SUPPORT_INBOX_TRIAGE_PROMPT_VERSION } from "./prompt-registry";
import {
  supportInboxTriageAssistantResultSchema,
  type SupportInboxTriageAssistantResult,
} from "./schemas";

export const SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION = "support_inbox_triage_ai_result";
export const SUPPORT_INBOX_ENTITY_ID = "admin_support_inbox";

export type SupportInboxTriageAiStoredResult =
  StoredAiRecommendationRecord<SupportInboxTriageAssistantResult>;

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function resolveSupportInboxTriageAssistantContext(): Promise<SupportInboxTriageAssistantContext> {
  const excludedVendorIds = new Set(launchExcludedVendorIds());
  const excludedUserIds = new Set(launchExcludedUserIds());
  const notifications = ((await withTransientDbRetry(() =>
    (prisma as any).adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            businessName: true,
            name: true,
          },
        },
      },
      take: 60,
    })
  )) as any[]).filter((notification: any) => {
    if (notification.vendorId && excludedVendorIds.has(String(notification.vendorId))) {
      return false;
    }

    const metadata = parseMetadata(notification.metadata);
    const metadataVendorIds = [metadata?.vendorId, metadata?.reportedVendorId, metadata?.reporterVendorId]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (metadataVendorIds.some((id) => excludedVendorIds.has(id))) {
      return false;
    }

    const metadataUserIds = [metadata?.reporterUserId, metadata?.reportedUserId, metadata?.userId]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (metadataUserIds.some((id) => excludedUserIds.has(id))) {
      return false;
    }

    return true;
  });

  return {
    unreadCount: notifications.filter((item) => !item.read).length,
    totalCount: notifications.length,
    notifications: notifications.map((item: any) => ({
      id: String(item.id),
      type: String(item.type || "UNKNOWN"),
      title: String(item.title || "Untitled notification"),
      message: String(item.message || ""),
      vendorName: item.vendor?.businessName || item.vendor?.name || null,
      createdAt: item.createdAt?.toISOString?.() || null,
      read: Boolean(item.read),
    })),
  };
}

export async function generateSupportInboxTriageAiStoredResult(
  actorUserId: string,
  source: string | null
): Promise<SupportInboxTriageAiStoredResult> {
  const context = await resolveSupportInboxTriageAssistantContext();
  const ai = await getSupportInboxTriageAssistantSuggestion(context, actorUserId);
  const storedResult: SupportInboxTriageAiStoredResult = {
    aiRunId: ai.responseId,
    feature: "support_inbox_triage",
    operation: "triage_support_and_alert_inbox",
    promptVersion: SUPPORT_INBOX_TRIAGE_PROMPT_VERSION,
    model: ai.model,
    usage: ai.usage,
    suggestion: ai.data,
    fingerprint: buildAiRecommendationFingerprint(context),
    source,
    generatedAt: new Date().toISOString(),
    actorUserId,
    queue: {
      title: "Support and alert inbox triage",
      summary: ai.data.summary,
      decision:
        context.unreadCount > 0
          ? "triage_required"
          : "inbox_clear",
      confidence: ai.data.confidence,
      severity: ai.data.redFlags.length > 0 ? "critical" : context.unreadCount > 0 ? "warning" : "info",
      scope: "admin_triage",
      surfaceHref: "/admin/notifications",
      relatedEntityType: "notification",
      relatedEntityId: SUPPORT_INBOX_ENTITY_ID,
      relatedEntityLabel: "Support and alert inbox",
      blockers: ai.data.redFlags,
      recommendedActions: ai.data.recommendedActions,
    },
  };

  await persistAiRecommendationRecord({
    actionType: SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION,
    entityType: "notification",
    entityId: SUPPORT_INBOX_ENTITY_ID,
    actorUserId,
    record: storedResult,
  });

  return storedResult;
}

export async function getLatestSupportInboxTriageAiStoredResult(): Promise<SupportInboxTriageAiStoredResult | null> {
  return getLatestStoredAiRecommendation(
    SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION,
    "notification",
    SUPPORT_INBOX_ENTITY_ID,
    supportInboxTriageAssistantResultSchema
  );
}
