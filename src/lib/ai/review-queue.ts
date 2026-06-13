import { prisma } from "@/server/db";
import { withTransientDbRetry } from "@/lib/transient-db-errors";
import {
  getLatestAiRecommendationQueueRows,
  parseAiRecommendationQueueMetadata,
  type AiRecommendationSeverity,
} from "./recommendation-records";
import { VENDOR_APPROVAL_AI_RESULT_ACTION } from "./vendor-approval-review-store";
import { REVIEW_MODERATION_AI_RESULT_ACTION } from "./review-moderation-review-store";
import { PUBLISH_READINESS_AI_RESULT_ACTION } from "./publish-readiness-review-store";
import { PROMOTION_READINESS_AI_RESULT_ACTION } from "./promotion-readiness-review-store";
import {
  SUPPORT_INBOX_ENTITY_ID,
  SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION,
} from "./support-inbox-triage-store";

export const AI_OWNER_QUEUE_ACTION_TYPES = [
  VENDOR_APPROVAL_AI_RESULT_ACTION,
  REVIEW_MODERATION_AI_RESULT_ACTION,
  PUBLISH_READINESS_AI_RESULT_ACTION,
  PROMOTION_READINESS_AI_RESULT_ACTION,
  SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION,
] as const;

export type AiOwnerQueueItem = {
  actionType: string;
  feature: string;
  title: string;
  summary: string;
  decision: string;
  confidence: "low" | "medium" | "high";
  severity: AiRecommendationSeverity;
  surfaceHref: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEntityLabel: string;
  blockers: string[];
  recommendedActions: string[];
  generatedAt: string | null;
  actorUserId: string | null;
  currentStatus: string;
  reasonOpen: string;
};

export type AiOwnerQueueSnapshot = {
  counts: {
    unresolved: number;
    redFlags: number;
    needsReview: number;
  };
  items: AiOwnerQueueItem[];
};

export async function getAiOwnerQueueSnapshot(): Promise<AiOwnerQueueSnapshot> {
  const rows = await getLatestAiRecommendationQueueRows(
    Array.from(AI_OWNER_QUEUE_ACTION_TYPES)
  );
  const parsedRows = rows
    .map((row) => {
      const parsed = parseAiRecommendationQueueMetadata(
        row.metadata,
        row.createdAt,
        row.actorUserId
      );
      return parsed
        ? {
            ...parsed,
            actionType: row.actionType,
            entityType: row.entityType,
            entityId: row.entityId,
          }
        : null;
    })
    .filter(
      (
        row
      ): row is NonNullable<
        ReturnType<typeof parseAiRecommendationQueueMetadata>
      > & {
        actionType: string;
        entityType: string;
        entityId: string;
      } => Boolean(row && row.queue.scope.startsWith("admin_"))
    );

  const vendorApprovalIds = parsedRows
    .filter((row) => row.actionType === VENDOR_APPROVAL_AI_RESULT_ACTION)
    .map((row) => row.queue.relatedEntityId);
  const reviewIds = parsedRows
    .filter((row) => row.actionType === REVIEW_MODERATION_AI_RESULT_ACTION)
    .map((row) => row.queue.relatedEntityId);
  const publishVendorIds = parsedRows
    .filter((row) => row.actionType === PUBLISH_READINESS_AI_RESULT_ACTION)
    .map((row) => row.queue.relatedEntityId);
  const promotionIds = parsedRows
    .filter((row) => row.actionType === PROMOTION_READINESS_AI_RESULT_ACTION)
    .map((row) => row.queue.relatedEntityId);

  const [
    pendingMemberships,
    reviews,
    publishVendors,
    campaigns,
    unreadNotificationCount,
  ] = await withTransientDbRetry(() =>
    Promise.all([
      vendorApprovalIds.length
        ? (prisma as any).vendorMembership.findMany({
            where: {
              role: "MANAGER",
              status: "PENDING",
              vendorId: { in: vendorApprovalIds },
            },
            select: {
              vendorId: true,
            },
          })
        : Promise.resolve([]),
      reviewIds.length
        ? prisma.review.findMany({
            where: { id: { in: reviewIds } },
            select: {
              id: true,
              moderationStatus: true,
              visibilityStatus: true,
            },
          })
        : Promise.resolve([]),
      publishVendorIds.length
        ? prisma.vendor.findMany({
            where: { id: { in: publishVendorIds } },
            select: {
              id: true,
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
                  isPublished: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      promotionIds.length
        ? (prisma as any).promotionCampaign.findMany({
            where: { id: { in: promotionIds } },
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              vendor: {
                select: {
                  isPubliclyListed: true,
                  accountStatus: true,
                },
              },
              service: {
                select: {
                  isPublished: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      (prisma as any).adminNotification.count({
        where: { read: false },
      }),
    ])
  );

  const pendingVendorIdSet = new Set(
    (pendingMemberships as Array<{ vendorId: string }>).map((row) => String(row.vendorId))
  );
  const reviewMap = new Map(
    (reviews as Array<{
      id: string;
      moderationStatus: string;
      visibilityStatus: string;
    }>).map((row) => [String(row.id), row] as const)
  );
  const publishVendorMap = new Map(
    (publishVendors as Array<{
      id: string;
      isPubliclyListed: boolean;
      memberships: Array<{ status: string }>;
      services: Array<{ id: string; isPublished: boolean }>;
    }>).map((row) => [String(row.id), row] as const)
  );
  const promotionMap = new Map(
    (campaigns as Array<{
      id: string;
      status: string;
      paymentStatus: string;
      vendor: { isPubliclyListed: boolean; accountStatus: string } | null;
      service: { isPublished: boolean } | null;
    }>).map((row) => [String(row.id), row] as const)
  );

  const items: AiOwnerQueueItem[] = [];

  for (const row of parsedRows) {
    let currentStatus = "Open";
    let reasonOpen = "Still needs review.";
    let unresolved = false;

    if (row.actionType === VENDOR_APPROVAL_AI_RESULT_ACTION) {
      unresolved = pendingVendorIdSet.has(row.queue.relatedEntityId);
      currentStatus = unresolved
        ? "Vendor is still pending approval."
        : "Vendor approval is no longer pending.";
      reasonOpen = unresolved
        ? "Admin approval has not been finalized yet."
        : "Resolved";
    } else if (row.actionType === REVIEW_MODERATION_AI_RESULT_ACTION) {
      const review = reviewMap.get(row.queue.relatedEntityId);
      const moderationStatus = String(review?.moderationStatus || "").toLowerCase();
      unresolved =
        moderationStatus === "pending_review" || moderationStatus === "flagged";
      currentStatus = review
        ? `Current review state: ${review.moderationStatus} / ${review.visibilityStatus}`
        : "Review no longer found.";
      reasonOpen = unresolved
        ? "Review still needs a final moderation outcome."
        : "Resolved";
    } else if (row.actionType === PUBLISH_READINESS_AI_RESULT_ACTION) {
      const vendor = publishVendorMap.get(row.queue.relatedEntityId);
      const membershipStatus = String(vendor?.memberships?.[0]?.status || "UNKNOWN").toUpperCase();
      const publishedServiceCount = vendor?.services?.filter((service) => service.isPublished).length || 0;
      unresolved =
        membershipStatus !== "ACTIVE" ||
        !Boolean(vendor?.isPubliclyListed) ||
        publishedServiceCount === 0;
      currentStatus = vendor
        ? `Membership ${membershipStatus}; vendor listed ${vendor.isPubliclyListed ? "yes" : "no"}; published services ${publishedServiceCount}.`
        : "Vendor no longer found.";
      reasonOpen = unresolved
        ? "Public visibility prerequisites are still incomplete."
        : "Resolved";
    } else if (row.actionType === PROMOTION_READINESS_AI_RESULT_ACTION) {
      const campaign = promotionMap.get(row.queue.relatedEntityId);
      const status = String(campaign?.status || "").toLowerCase();
      const isTerminal = ["ended", "expired", "cancelled", "rejected"].includes(status);
      unresolved = Boolean(campaign) && !isTerminal;
      currentStatus = campaign
        ? `Campaign is ${campaign.status}; payment ${campaign.paymentStatus}; vendor public ${campaign.vendor?.isPubliclyListed ? "yes" : "no"}; service published ${campaign.service?.isPublished ? "yes" : "no"}.`
        : "Campaign no longer found.";
      reasonOpen = unresolved
        ? "Campaign is still active, scheduled, paused, or draft."
        : "Resolved";
    } else if (row.actionType === SUPPORT_INBOX_TRIAGE_AI_RESULT_ACTION) {
      unresolved = row.queue.relatedEntityId === SUPPORT_INBOX_ENTITY_ID && unreadNotificationCount > 0;
      currentStatus = `${unreadNotificationCount} unread internal notifications remain.`;
      reasonOpen = unresolved
        ? "Unread support or alert notifications still need triage."
        : "Resolved";
    }

    if (!unresolved) continue;

    items.push({
      actionType: row.actionType,
      feature: row.feature,
      title: row.queue.title,
      summary: row.queue.summary,
      decision: row.queue.decision,
      confidence: row.queue.confidence,
      severity: row.queue.severity,
      surfaceHref: row.queue.surfaceHref,
      relatedEntityType: row.queue.relatedEntityType,
      relatedEntityId: row.queue.relatedEntityId,
      relatedEntityLabel: row.queue.relatedEntityLabel,
      blockers: row.queue.blockers,
      recommendedActions: row.queue.recommendedActions,
      generatedAt: row.generatedAt,
      actorUserId: row.actorUserId,
      currentStatus,
      reasonOpen,
    });
  }

  items.sort((left, right) => {
    const severityRank = { critical: 3, warning: 2, info: 1 };
    const severityDelta =
      severityRank[right.severity] - severityRank[left.severity];
    if (severityDelta !== 0) return severityDelta;
    return (
      new Date(right.generatedAt || right.relatedEntityId).getTime() -
      new Date(left.generatedAt || left.relatedEntityId).getTime()
    );
  });

  return {
    counts: {
      unresolved: items.length,
      redFlags: items.filter((item) => item.severity === "critical").length,
      needsReview: items.filter((item) => item.severity !== "info").length,
    },
    items,
  };
}
