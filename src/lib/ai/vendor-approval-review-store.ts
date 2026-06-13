import crypto from "crypto";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/server/db";
import { withTransientDbRetry } from "@/lib/transient-db-errors";
import {
  getVendorApprovalAssistantSuggestion,
  type VendorApprovalAssistantContext,
} from "./vendor-approval-assistant";
import { VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  type VendorApprovalAssistantResult,
  vendorApprovalAssistantResultSchema,
} from "./schemas";
import type { AiRecommendationQueueMetadata } from "./recommendation-records";

export const VENDOR_APPROVAL_AI_RESULT_ACTION = "vendor_approval_ai_result";
export const VENDOR_APPROVAL_AI_SYSTEM_ACTOR = "system_ai";

export type VendorApprovalAiUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type VendorApprovalAiApplicationSnapshot = {
  emailVerified: boolean;
  serviceDraftCount: number;
  publishedServiceCount: number;
  submittedAt: string | null;
};

export type VendorApprovalAiStoredResult = {
  aiRunId: string;
  promptVersion: string;
  model: string;
  usage: VendorApprovalAiUsage | null;
  suggestion: VendorApprovalAssistantResult;
  applicationSnapshot: VendorApprovalAiApplicationSnapshot;
  fingerprint: string;
  source: string | null;
  generatedAt: string | null;
  actorUserId: string | null;
};

export type VendorApprovalPendingSource = {
  vendor: any;
  membership: any;
};

type VendorApprovalContextResolution =
  | {
      status: "ok";
      source: VendorApprovalPendingSource;
      context: VendorApprovalAssistantContext;
      fingerprint: string;
      applicationSnapshot: VendorApprovalAiApplicationSnapshot;
    }
  | { status: "vendor_not_found" }
  | { status: "not_pending" };

function cleanText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeUsage(value: unknown): VendorApprovalAiUsage | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    inputTokens:
      source.inputTokens == null ? null : Number(source.inputTokens),
    outputTokens:
      source.outputTokens == null ? null : Number(source.outputTokens),
    totalTokens:
      source.totalTokens == null ? null : Number(source.totalTokens),
  };
}

function buildVendorApprovalFingerprint(
  context: VendorApprovalAssistantContext
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(context))
    .digest("hex");
}

export function buildVendorApprovalContextResolutionFromPendingSource(
  source: VendorApprovalPendingSource
): VendorApprovalContextResolution {
  const vendor = source.vendor;
  const pendingMembership = source.membership;
  const foundedYear =
    typeof vendor?.foundedYear === "number" && Number.isFinite(vendor.foundedYear)
      ? vendor.foundedYear
      : null;
  const serviceDraftCount = Array.isArray(vendor?.services)
    ? vendor.services.filter((service: any) => !service?.isPublished).length
    : 0;
  const publishedServiceCount = Array.isArray(vendor?.services)
    ? vendor.services.filter((service: any) => Boolean(service?.isPublished)).length
    : 0;

  const context: VendorApprovalAssistantContext = {
    vendorId: String(vendor.id),
    businessName:
      cleanText(vendor.businessName) || cleanText(vendor.name) || "Unnamed Vendor",
    ownerName: cleanText(pendingMembership.user?.name),
    category: cleanText(vendor.category),
    businessType: cleanText(vendor.businessType),
    submittedAt:
      pendingMembership.requestedAt instanceof Date
        ? pendingMembership.requestedAt.toISOString()
        : null,
    createdAt: vendor.createdAt instanceof Date ? vendor.createdAt.toISOString() : null,
    foundedYear,
    yearsInBusiness:
      foundedYear !== null ? Math.max(0, new Date().getFullYear() - foundedYear) : null,
    vendorEmail: cleanText(vendor.email),
    managerEmail: cleanText(pendingMembership.user?.email),
    vendorPhone: cleanText(vendor.phone),
    managerPhone: cleanText(pendingMembership.user?.phone),
    address: cleanText(vendor.address),
    city: cleanText(vendor.city),
    state: cleanText(vendor.state),
    zipCode: cleanText(vendor.zipCode),
    hasBusinessBio: Boolean(cleanText(vendor.bio)),
    hasWebsite: Boolean(cleanText(vendor.website)),
    hasLicenseNumber: Boolean(cleanText(vendor.licenseNumber)),
    insuranceStatus: Boolean(vendor.insuranceStatus),
    bondingStatus: Boolean(vendor.bondingStatus),
    hasServiceTypes: Boolean(cleanText(vendor.serviceTypes)),
    hasSpecializations: Boolean(cleanText(vendor.specializations)),
    hasServiceAreas: Boolean(cleanText(vendor.serviceAreas)),
    geocoded: Boolean(vendor.geocodedAt),
    emailVerified: Boolean(pendingMembership.user?.authCredential?.emailVerifiedAt),
    authCredentialCreatedAt:
      pendingMembership.user?.authCredential?.createdAt instanceof Date
        ? pendingMembership.user.authCredential.createdAt.toISOString()
        : null,
    membershipStatus: String(pendingMembership.status || "PENDING"),
    serviceDraftCount,
    publishedServiceCount,
  };

  return {
    status: "ok",
    source,
    context,
    fingerprint: buildVendorApprovalFingerprint(context),
    applicationSnapshot: {
      emailVerified: context.emailVerified,
      serviceDraftCount,
      publishedServiceCount,
      submittedAt: context.submittedAt,
    },
  };
}

async function getPendingSourceForVendor(
  vendorId: string
): Promise<VendorApprovalPendingSource | null> {
  const vendor = (await withTransientDbRetry(() =>
    (prisma as any).vendor.findUnique({
      where: { id: String(vendorId) },
      select: {
        id: true,
        name: true,
        businessName: true,
        businessType: true,
        category: true,
        foundedYear: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        address: true,
        zipCode: true,
        geocodedAt: true,
        bio: true,
        website: true,
        licenseNumber: true,
        insuranceStatus: true,
        bondingStatus: true,
        serviceTypes: true,
        specializations: true,
        serviceAreas: true,
        createdAt: true,
        services: {
          select: {
            id: true,
            isPublished: true,
          },
        },
        memberships: {
          where: {
            role: "MANAGER",
            status: "PENDING",
          },
          orderBy: [{ requestedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            requestedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                authCredential: {
                  select: {
                    id: true,
                    emailVerifiedAt: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  )) as any;

  if (!vendor) return null;

  const membership = Array.isArray(vendor.memberships) ? vendor.memberships[0] : null;
  if (!membership) {
    return {
      vendor,
      membership: null,
    };
  }

  return {
    vendor,
    membership,
  };
}

export async function resolveVendorApprovalAssistantContext(
  vendorId: string
): Promise<VendorApprovalContextResolution> {
  const source = await getPendingSourceForVendor(vendorId);
  if (!source) return { status: "vendor_not_found" };
  if (!source.membership) return { status: "not_pending" };
  return buildVendorApprovalContextResolutionFromPendingSource(source as VendorApprovalPendingSource);
}

function parseStoredResultMetadata(
  metadataRaw: string | null | undefined,
  createdAt: Date | string,
  actorUserId: string | null | undefined
): VendorApprovalAiStoredResult | null {
  if (!metadataRaw) return null;

  let parsed: Record<string, unknown>;
  try {
    const candidate = JSON.parse(metadataRaw) as unknown;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    parsed = candidate as Record<string, unknown>;
  } catch {
    return null;
  }

  const suggestionResult = vendorApprovalAssistantResultSchema.safeParse(parsed.suggestion);
  if (!suggestionResult.success) return null;

  const snapshot =
    parsed.applicationSnapshot &&
    typeof parsed.applicationSnapshot === "object" &&
    !Array.isArray(parsed.applicationSnapshot)
      ? (parsed.applicationSnapshot as Record<string, unknown>)
      : null;

  return {
    aiRunId: cleanText(parsed.aiRunId) || "",
    promptVersion:
      cleanText(parsed.promptVersion) || VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION,
    model: cleanText(parsed.model) || "unknown",
    usage: normalizeUsage(parsed.usage),
    suggestion: suggestionResult.data,
    applicationSnapshot: {
      emailVerified: Boolean(snapshot?.emailVerified),
      serviceDraftCount: Number(snapshot?.serviceDraftCount || 0),
      publishedServiceCount: Number(snapshot?.publishedServiceCount || 0),
      submittedAt: cleanText(snapshot?.submittedAt),
    },
    fingerprint: cleanText(parsed.fingerprint) || "",
    source: cleanText(parsed.source),
    generatedAt:
      cleanText(parsed.generatedAt) ||
      (createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)),
    actorUserId: cleanText(actorUserId),
  };
}

function buildVendorApprovalQueueMetadata(
  vendorId: string,
  businessName: string,
  suggestion: VendorApprovalAssistantResult
): AiRecommendationQueueMetadata {
  return {
    title: `Vendor approval: ${businessName}`,
    summary: suggestion.summary,
    decision: suggestion.decision,
    confidence: suggestion.confidence,
    severity:
      suggestion.decision === "recommend_reject"
        ? "critical"
        : suggestion.decision === "needs_manual_review"
          ? "warning"
          : "info",
    scope: "admin_action",
    surfaceHref: `/admin/vendors/approval-queue?search=${encodeURIComponent(businessName)}`,
    relatedEntityType: "vendor",
    relatedEntityId: vendorId,
    relatedEntityLabel: businessName,
    blockers: suggestion.blockingIssues,
    recommendedActions: suggestion.recommendedActions,
  };
}

export async function getLatestVendorApprovalAiStoredResult(
  vendorId: string
): Promise<VendorApprovalAiStoredResult | null> {
  const rows = (await withTransientDbRetry(() =>
    (prisma as any).adminAuditLog.findMany({
      where: {
        actionType: VENDOR_APPROVAL_AI_RESULT_ACTION,
        entityType: "vendor",
        entityId: String(vendorId),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1,
      select: {
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    })
  )) as Array<{ metadata: string | null; createdAt: Date | string; actorUserId: string }>;

  if (!rows.length) return null;
  return parseStoredResultMetadata(rows[0].metadata, rows[0].createdAt, rows[0].actorUserId);
}

export async function getLatestVendorApprovalAiStoredResults(
  vendorIds: string[]
): Promise<Record<string, VendorApprovalAiStoredResult>> {
  const normalizedVendorIds = Array.from(
    new Set(vendorIds.map((value) => String(value || "").trim()).filter(Boolean))
  );
  if (normalizedVendorIds.length === 0) return {};

  const rows = (await withTransientDbRetry(() =>
    (prisma as any).adminAuditLog.findMany({
      where: {
        actionType: VENDOR_APPROVAL_AI_RESULT_ACTION,
        entityType: "vendor",
        entityId: { in: normalizedVendorIds },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        entityId: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    })
  )) as Array<{
    entityId: string;
    metadata: string | null;
    createdAt: Date | string;
    actorUserId: string;
  }>;

  const out: Record<string, VendorApprovalAiStoredResult> = {};
  for (const row of rows) {
    const key = String(row.entityId || "").trim();
    if (!key || out[key]) continue;
    const parsed = parseStoredResultMetadata(row.metadata, row.createdAt, row.actorUserId);
    if (parsed) out[key] = parsed;
  }
  return out;
}

async function persistVendorApprovalAiStoredResult(
  vendorId: string,
  actorUserId: string,
  result: VendorApprovalAiStoredResult,
  businessName: string
): Promise<void> {
  await createAdminAuditLog({
    actionType: VENDOR_APPROVAL_AI_RESULT_ACTION,
    entityType: "vendor",
    entityId: String(vendorId),
    actorUserId,
    metadata: {
      aiRunId: result.aiRunId,
      promptVersion: result.promptVersion,
      model: result.model,
      usage: result.usage,
      feature: "vendor_approval_assistant",
      operation: "review_vendor_application",
      suggestion: result.suggestion,
      applicationSnapshot: result.applicationSnapshot,
      fingerprint: result.fingerprint,
      source: result.source,
      generatedAt: result.generatedAt,
      queue: buildVendorApprovalQueueMetadata(vendorId, businessName, result.suggestion),
    },
  });
}

export async function generateVendorApprovalAiStoredResult(
  vendorId: string,
  options?: {
    actorUserId?: string | null;
    source?: string | null;
    resolution?: Extract<VendorApprovalContextResolution, { status: "ok" }>;
  }
): Promise<VendorApprovalAiStoredResult | null> {
  const resolution =
    options?.resolution || (await resolveVendorApprovalAssistantContext(vendorId));
  if (resolution.status !== "ok") return null;

  const actorUserId =
    cleanText(options?.actorUserId) || VENDOR_APPROVAL_AI_SYSTEM_ACTOR;
  const ai = await getVendorApprovalAssistantSuggestion(
    resolution.context,
    actorUserId
  );

  const storedResult: VendorApprovalAiStoredResult = {
    aiRunId: ai.responseId,
    promptVersion: VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION,
    model: ai.model,
    usage: ai.usage,
    suggestion: ai.data,
    applicationSnapshot: resolution.applicationSnapshot,
    fingerprint: resolution.fingerprint,
    source: cleanText(options?.source),
    generatedAt: new Date().toISOString(),
    actorUserId,
  };

  await persistVendorApprovalAiStoredResult(
    vendorId,
    actorUserId,
    storedResult,
    resolution.context.businessName
  );
  return storedResult;
}

export function serializeVendorApprovalAiStoredResult(
  result: VendorApprovalAiStoredResult | null | undefined
): VendorApprovalAiStoredResult | null {
  return result ? { ...result } : null;
}
