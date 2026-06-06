import { readAiEnv, type AiFeatureKey } from "./config";
import { redactValueForAiAudit } from "./redaction";

export type AiAuditStage = "request" | "response" | "error";

export type AiAuditUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type AiAuditEntry = {
  stage: AiAuditStage;
  feature: AiFeatureKey;
  operation: string;
  actorUserId?: string | null;
  entityId?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  requestId?: string | null;
  responseId?: string | null;
  durationMs?: number | null;
  usage?: AiAuditUsage | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

function resolveEntityId(entry: AiAuditEntry): string {
  const explicit = String(entry.entityId || "").trim();
  if (explicit) return explicit;
  return `${entry.feature}:${entry.operation}`;
}

function resolveActorUserId(actorUserId: string | null | undefined): string {
  const explicit = String(actorUserId || "").trim();
  return explicit || "system_ai";
}

export async function logAiAuditEvent(entry: AiAuditEntry): Promise<void> {
  if (!readAiEnv().auditLoggingEnabled) return;

  const metadata = redactValueForAiAudit({
    feature: entry.feature,
    operation: entry.operation,
    model: entry.model ?? null,
    promptVersion: entry.promptVersion ?? null,
    requestId: entry.requestId ?? null,
    responseId: entry.responseId ?? null,
    durationMs: entry.durationMs ?? null,
    usage: entry.usage ?? null,
    inputPreview: entry.inputPreview ?? null,
    outputPreview: entry.outputPreview ?? null,
    errorMessage: entry.errorMessage ?? null,
    ...(entry.metadata ?? {}),
  }) as Record<string, unknown>;

  try {
    const { createAdminAuditLog } = await import("@/lib/admin-audit");
    await createAdminAuditLog({
      actionType: `ai_${entry.stage}`,
      entityType: "ai_run",
      entityId: resolveEntityId(entry),
      actorUserId: resolveActorUserId(entry.actorUserId),
      metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ai-audit] write failed (non-fatal)", {
        stage: entry.stage,
        feature: entry.feature,
        operation: entry.operation,
        entityId: entry.entityId,
        actorUserId: entry.actorUserId,
        error: (error as Error)?.message || String(error),
      });
    }
  }
}
