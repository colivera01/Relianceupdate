import crypto from "crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { logAiAuditEvent, type AiAuditUsage } from "./audit";
import {
  getAiFeatureModel,
  logAiEnvWarnings,
  readAiEnv,
  type AiFeatureKey,
} from "./config";
import { AiConfigurationError, AiFeatureDisabledError, AiRequestFailedError, AiSchemaValidationError, getAiErrorMessage } from "./errors";
import { isAiFeatureEnabled } from "./feature-flags";
import { redactTextForAiAudit } from "./redaction";

const globalForOpenAI = globalThis as unknown as {
  relianceOpenAiClient?: OpenAI | undefined;
  relianceAiInflightTasks?: Map<string, Promise<StructuredAiTaskResult<any>>> | undefined;
};

export type AiReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type StructuredAiTaskRequest<Schema extends z.ZodType> = {
  feature: AiFeatureKey;
  operation: string;
  schema: Schema;
  instructions: string;
  input: string;
  promptVersion: string;
  actorUserId?: string | null;
  entityId?: string | null;
  model?: string;
  metadata?: Record<string, unknown> | null;
  maxOutputTokens?: number;
  reasoningEffort?: AiReasoningEffort;
  validateData?: (data: z.infer<Schema>) => void | Promise<void>;
};

export type StructuredAiTaskResult<Data> = {
  data: Data;
  model: string;
  responseId: string;
  requestId: string | null;
  usage: AiAuditUsage | null;
};

type OpenAiResponsesClient = {
  responses: {
    parse: (body: Record<string, unknown>) => Promise<{
      id: string;
      model: string;
      output_parsed: unknown;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      } | null;
      _request_id?: string | null;
    }>;
  };
};

function getInflightTaskMap(): Map<string, Promise<StructuredAiTaskResult<any>>> {
  if (!globalForOpenAI.relianceAiInflightTasks) {
    globalForOpenAI.relianceAiInflightTasks = new Map();
  }
  return globalForOpenAI.relianceAiInflightTasks;
}

function toOpenAiMetadata(
  request: Pick<StructuredAiTaskRequest<z.ZodType>, "feature" | "operation" | "promptVersion" | "entityId">
): Record<string, string> {
  const metadataEntries = Object.entries({
    feature: request.feature,
    operation: request.operation,
    prompt_version: request.promptVersion,
    entity_id: request.entityId ?? "",
  })
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => [key, String(value).trim().slice(0, 512)] as const);

  return Object.fromEntries(metadataEntries);
}

function buildSafetyIdentifier(actorUserId: string | null | undefined, feature: AiFeatureKey): string {
  const seed = String(actorUserId || `system:${feature}`).trim();
  return crypto.createHash("sha256").update(`reliance:${seed}`).digest("hex").slice(0, 64);
}

function normalizeSchemaName(feature: AiFeatureKey, operation: string): string {
  return `${feature}_${operation}`
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function extractUsage(response: {
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } | null;
}): AiAuditUsage | null {
  if (!response.usage) return null;
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
  };
}

function buildInflightTaskKey<Schema extends z.ZodType>(
  request: StructuredAiTaskRequest<Schema>,
  model: string
): string {
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        feature: request.feature,
        operation: request.operation,
        promptVersion: request.promptVersion,
        entityId: request.entityId ?? "",
        model,
        input: request.input,
      })
    )
    .digest("hex");

  return `${request.feature}:${request.operation}:${model}:${fingerprint}`;
}

export function getOpenAiClient(): OpenAiResponsesClient {
  logAiEnvWarnings();
  const env = readAiEnv();

  if (!env.apiKey) {
    throw new AiConfigurationError("OPENAI_API_KEY is missing.");
  }
  if (!env.projectId) {
    throw new AiConfigurationError("OPENAI_PROJECT_ID is missing.");
  }

  if (!globalForOpenAI.relianceOpenAiClient) {
    globalForOpenAI.relianceOpenAiClient = new OpenAI({
      apiKey: env.apiKey,
      project: env.projectId,
      organization: env.organization || undefined,
      timeout: env.timeoutMs,
      maxRetries: env.maxRetries,
    });
  }

  return globalForOpenAI.relianceOpenAiClient;
}

export async function runStructuredAiTask<Schema extends z.ZodType>(
  request: StructuredAiTaskRequest<Schema>,
  client: OpenAiResponsesClient = getOpenAiClient()
): Promise<StructuredAiTaskResult<z.infer<Schema>>> {
  const env = readAiEnv();
  if (!env.enabled) {
    throw new AiFeatureDisabledError("OpenAI features are globally disabled.", {
      feature: request.feature,
    });
  }
  if (!isAiFeatureEnabled(request.feature, env)) {
    throw new AiFeatureDisabledError(`AI feature "${request.feature}" is disabled.`, {
      feature: request.feature,
    });
  }

  const model = request.model || getAiFeatureModel(request.feature, env);
  const inflightTaskKey = buildInflightTaskKey(request, model);
  const inflightTasks = getInflightTaskMap();
  const existingTask = inflightTasks.get(inflightTaskKey);
  if (existingTask) {
    return (await existingTask) as StructuredAiTaskResult<z.infer<Schema>>;
  }

  const inputPreview = redactTextForAiAudit(request.input);
  const startedAt = Date.now();

  const taskPromise = (async () => {
    await logAiAuditEvent({
      stage: "request",
      feature: request.feature,
      operation: request.operation,
      actorUserId: request.actorUserId,
      entityId: request.entityId,
      model,
      promptVersion: request.promptVersion,
      inputPreview,
      metadata: request.metadata ?? null,
    });

    try {
      const response = await client.responses.parse({
        model,
        instructions: request.instructions,
        input: request.input,
        metadata: toOpenAiMetadata(request as StructuredAiTaskRequest<z.ZodType>),
        safety_identifier: buildSafetyIdentifier(request.actorUserId, request.feature),
        max_output_tokens: request.maxOutputTokens,
        reasoning: request.reasoningEffort ? { effort: request.reasoningEffort } : undefined,
        text: {
          format: zodTextFormat(request.schema, normalizeSchemaName(request.feature, request.operation)),
        },
      });

      if (response.output_parsed == null) {
        throw new AiSchemaValidationError("OpenAI returned no parsed structured output.", {
          feature: request.feature,
          operation: request.operation,
          responseId: response.id,
        });
      }

      await request.validateData?.(response.output_parsed as z.infer<Schema>);

      const usage = extractUsage(response);
      const outputPreview = redactTextForAiAudit(JSON.stringify(response.output_parsed));

      await logAiAuditEvent({
        stage: "response",
        feature: request.feature,
        operation: request.operation,
        actorUserId: request.actorUserId,
        entityId: request.entityId,
        model: response.model,
        promptVersion: request.promptVersion,
        requestId: response._request_id ?? null,
        responseId: response.id,
        durationMs: Date.now() - startedAt,
        usage,
        outputPreview,
        metadata: request.metadata ?? null,
      });

      return {
        data: response.output_parsed as z.infer<Schema>,
        model: response.model,
        responseId: response.id,
        requestId: response._request_id ?? null,
        usage,
      };
    } catch (error) {
      const message = getAiErrorMessage(error);

      await logAiAuditEvent({
        stage: "error",
        feature: request.feature,
        operation: request.operation,
        actorUserId: request.actorUserId,
        entityId: request.entityId,
        model,
        promptVersion: request.promptVersion,
        durationMs: Date.now() - startedAt,
        inputPreview,
        errorMessage: message,
        metadata: request.metadata ?? null,
      });

      if (error instanceof AiConfigurationError || error instanceof AiFeatureDisabledError || error instanceof AiSchemaValidationError) {
        throw error;
      }

      throw new AiRequestFailedError(message, {
        feature: request.feature,
        operation: request.operation,
        model,
      });
    }
  })();

  inflightTasks.set(inflightTaskKey, taskPromise as Promise<StructuredAiTaskResult<any>>);
  try {
    return await taskPromise;
  } finally {
    if (inflightTasks.get(inflightTaskKey) === taskPromise) {
      inflightTasks.delete(inflightTaskKey);
    }
  }
}
