import crypto from "crypto";
import { z } from "zod";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { withTransientDbRetry } from "@/lib/transient-db-errors";
import { prisma } from "@/server/db";
import type { AiFeatureKey } from "./config";

export const AI_RECOMMENDATION_QUEUE_SCOPES = [
  "admin_action",
  "admin_triage",
  "vendor_self_service",
  "employee_self_service",
] as const;

export type AiRecommendationQueueScope =
  (typeof AI_RECOMMENDATION_QUEUE_SCOPES)[number];

export const AI_RECOMMENDATION_SEVERITIES = [
  "info",
  "warning",
  "critical",
] as const;

export type AiRecommendationSeverity =
  (typeof AI_RECOMMENDATION_SEVERITIES)[number];

export type AiRecommendationUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type AiRecommendationQueueMetadata = {
  title: string;
  summary: string;
  decision: string;
  confidence: "low" | "medium" | "high";
  severity: AiRecommendationSeverity;
  scope: AiRecommendationQueueScope;
  surfaceHref: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEntityLabel: string;
  blockers: string[];
  recommendedActions: string[];
};

export type StoredAiRecommendationRecord<TSuggestion> = {
  aiRunId: string;
  feature: AiFeatureKey;
  operation: string;
  promptVersion: string;
  model: string;
  usage: AiRecommendationUsage | null;
  suggestion: TSuggestion;
  fingerprint: string;
  source: string | null;
  generatedAt: string | null;
  actorUserId: string | null;
  queue: AiRecommendationQueueMetadata;
};

type PersistAiRecommendationRecordInput<TSuggestion> = {
  actionType: string;
  entityType:
    | "vendor"
    | "service"
    | "review"
    | "review_window"
    | "consent"
    | "notification"
    | "booking"
    | "device"
    | "membership"
    | "user"
    | "content_report"
    | "promotion_campaign"
    | "promotion_package"
    | "ai_run";
  entityId: string;
  actorUserId: string;
  record: StoredAiRecommendationRecord<TSuggestion>;
};

const queueMetadataSchema = z.object({
  title: z.string().min(1).max(220),
  summary: z.string().min(1).max(1500),
  decision: z.string().min(1).max(120),
  confidence: z.enum(["low", "medium", "high"]),
  severity: z.enum(AI_RECOMMENDATION_SEVERITIES),
  scope: z.enum(AI_RECOMMENDATION_QUEUE_SCOPES),
  surfaceHref: z.string().min(1).max(260),
  relatedEntityType: z.string().min(1).max(80),
  relatedEntityId: z.string().min(1).max(120),
  relatedEntityLabel: z.string().min(1).max(240),
  blockers: z.array(z.string().min(1).max(240)).max(8).default([]),
  recommendedActions: z.array(z.string().min(1).max(240)).max(8).default([]),
});

function cleanText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeUsage(value: unknown): AiRecommendationUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
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

export function buildAiRecommendationFingerprint(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export async function persistAiRecommendationRecord<TSuggestion>(
  input: PersistAiRecommendationRecordInput<TSuggestion>
): Promise<void> {
  await createAdminAuditLog({
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: String(input.entityId),
    actorUserId: input.actorUserId,
    metadata: {
      aiRunId: input.record.aiRunId,
      feature: input.record.feature,
      operation: input.record.operation,
      promptVersion: input.record.promptVersion,
      model: input.record.model,
      usage: input.record.usage,
      suggestion: input.record.suggestion,
      fingerprint: input.record.fingerprint,
      source: input.record.source,
      generatedAt: input.record.generatedAt,
      queue: input.record.queue,
    },
  });
}

export function parseStoredAiRecommendationRecord<TSuggestion>(
  metadataRaw: string | null | undefined,
  createdAt: Date | string,
  actorUserId: string | null | undefined,
  suggestionSchema: z.ZodType<TSuggestion>
): StoredAiRecommendationRecord<TSuggestion> | null {
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

  const suggestionResult = suggestionSchema.safeParse(parsed.suggestion);
  const queueResult = queueMetadataSchema.safeParse(parsed.queue);
  const feature = cleanText(parsed.feature) as AiFeatureKey | null;
  const operation = cleanText(parsed.operation);
  if (!suggestionResult.success || !queueResult.success || !feature || !operation) {
    return null;
  }

  return {
    aiRunId: cleanText(parsed.aiRunId) || "",
    feature,
    operation,
    promptVersion: cleanText(parsed.promptVersion) || "unknown",
    model: cleanText(parsed.model) || "unknown",
    usage: normalizeUsage(parsed.usage),
    suggestion: suggestionResult.data,
    fingerprint: cleanText(parsed.fingerprint) || "",
    source: cleanText(parsed.source),
    generatedAt:
      cleanText(parsed.generatedAt) ||
      (createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)),
    actorUserId: cleanText(actorUserId),
    queue: queueResult.data,
  };
}

export async function getLatestStoredAiRecommendation<TSuggestion>(
  actionType: string,
  entityType: string,
  entityId: string,
  suggestionSchema: z.ZodType<TSuggestion>
): Promise<StoredAiRecommendationRecord<TSuggestion> | null> {
  const rows = (await withTransientDbRetry(() =>
    (prisma as any).adminAuditLog.findMany({
      where: {
        actionType,
        entityType,
        entityId: String(entityId),
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
  return parseStoredAiRecommendationRecord(
    rows[0].metadata,
    rows[0].createdAt,
    rows[0].actorUserId,
    suggestionSchema
  );
}

export async function getLatestStoredAiRecommendations<TSuggestion>(
  actionType: string,
  entityType: string,
  entityIds: string[],
  suggestionSchema: z.ZodType<TSuggestion>
): Promise<Record<string, StoredAiRecommendationRecord<TSuggestion>>> {
  const normalizedIds = Array.from(
    new Set(entityIds.map((value) => String(value || "").trim()).filter(Boolean))
  );
  if (!normalizedIds.length) return {};

  const rows = (await withTransientDbRetry(() =>
    (prisma as any).adminAuditLog.findMany({
      where: {
        actionType,
        entityType,
        entityId: { in: normalizedIds },
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

  const out: Record<string, StoredAiRecommendationRecord<TSuggestion>> = {};
  for (const row of rows) {
    const key = String(row.entityId || "").trim();
    if (!key || out[key]) continue;
    const parsed = parseStoredAiRecommendationRecord(
      row.metadata,
      row.createdAt,
      row.actorUserId,
      suggestionSchema
    );
    if (parsed) out[key] = parsed;
  }
  return out;
}

export type LatestAiRecommendationQueueRow = {
  actionType: string;
  entityType: string;
  entityId: string;
  createdAt: Date | string;
  actorUserId: string;
  metadata: string | null;
};

export async function getLatestAiRecommendationQueueRows(
  actionTypes: string[]
): Promise<LatestAiRecommendationQueueRow[]> {
  const normalizedTypes = Array.from(
    new Set(actionTypes.map((value) => String(value || "").trim()).filter(Boolean))
  );
  if (!normalizedTypes.length) return [];

  const rows = (await withTransientDbRetry(() =>
    (prisma as any).adminAuditLog.findMany({
      where: {
        actionType: { in: normalizedTypes },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        actionType: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actorUserId: true,
        metadata: true,
      },
    })
  )) as LatestAiRecommendationQueueRow[];

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.actionType}:${row.entityType}:${row.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseAiRecommendationQueueMetadata(
  metadataRaw: string | null | undefined,
  createdAt: Date | string,
  actorUserId: string | null | undefined
): (StoredAiRecommendationRecord<Record<string, unknown>> & {
  createdAt: Date | string;
}) | null {
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

  const queueResult = queueMetadataSchema.safeParse(parsed.queue);
  const suggestion =
    parsed.suggestion && typeof parsed.suggestion === "object" && !Array.isArray(parsed.suggestion)
      ? (parsed.suggestion as Record<string, unknown>)
      : {};
  const feature = cleanText(parsed.feature) as AiFeatureKey | null;
  const operation = cleanText(parsed.operation);
  if (!queueResult.success || !feature || !operation) return null;

  return {
    aiRunId: cleanText(parsed.aiRunId) || "",
    feature,
    operation,
    promptVersion: cleanText(parsed.promptVersion) || "unknown",
    model: cleanText(parsed.model) || "unknown",
    usage: normalizeUsage(parsed.usage),
    suggestion,
    fingerprint: cleanText(parsed.fingerprint) || "",
    source: cleanText(parsed.source),
    generatedAt:
      cleanText(parsed.generatedAt) ||
      (createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)),
    actorUserId: cleanText(actorUserId),
    queue: queueResult.data,
    createdAt,
  };
}
