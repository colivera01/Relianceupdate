export const AI_FEATURE_KEYS = [
  "moderation_assistant",
  "dispute_summary_assistant",
  "trust_score_explanations",
  "vendor_coaching",
] as const;

export type AiFeatureKey = (typeof AI_FEATURE_KEYS)[number];

export type AiFeatureFlags = Record<AiFeatureKey, boolean>;

export type AiModelConfig = {
  defaultModel: string;
  moderationAssistantModel: string;
  disputeSummaryModel: string;
  trustScoreExplainerModel: string;
  vendorCoachingModel: string;
};

export type AiEnvSnapshot = {
  apiKey: string;
  projectId: string;
  organization: string;
  enabled: boolean;
  auditLoggingEnabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  models: AiModelConfig;
  features: AiFeatureFlags;
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 1;

function clean(raw: string | undefined): string {
  return String(raw || "").trim();
}

function parseEnvBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseEnvInteger(
  raw: string | undefined,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number {
  const normalized = clean(raw);
  if (!normalized) return defaultValue;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(maxValue, Math.max(minValue, parsed));
}

export function readAiEnv(): AiEnvSnapshot {
  const defaultModel = clean(process.env.OPENAI_DEFAULT_MODEL) || DEFAULT_MODEL;

  return {
    apiKey: clean(process.env.OPENAI_API_KEY),
    projectId: clean(process.env.OPENAI_PROJECT_ID),
    organization: clean(process.env.OPENAI_ORG_ID),
    enabled: parseEnvBoolean(process.env.OPENAI_ENABLED, false),
    auditLoggingEnabled: parseEnvBoolean(process.env.OPENAI_AUDIT_LOGGING_ENABLED, true),
    timeoutMs: parseEnvInteger(process.env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 120_000),
    maxRetries: parseEnvInteger(process.env.OPENAI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 5),
    models: {
      defaultModel,
      moderationAssistantModel:
        clean(process.env.OPENAI_MODERATION_ASSISTANT_MODEL) || defaultModel,
      disputeSummaryModel: clean(process.env.OPENAI_DISPUTE_SUMMARY_MODEL) || defaultModel,
      trustScoreExplainerModel:
        clean(process.env.OPENAI_TRUST_SCORE_EXPLAINER_MODEL) || defaultModel,
      vendorCoachingModel: clean(process.env.OPENAI_VENDOR_COACHING_MODEL) || defaultModel,
    },
    features: {
      moderation_assistant: parseEnvBoolean(
        process.env.OPENAI_MODERATION_ASSISTANT_ENABLED,
        false
      ),
      dispute_summary_assistant: parseEnvBoolean(
        process.env.OPENAI_DISPUTE_SUMMARY_ENABLED,
        false
      ),
      trust_score_explanations: parseEnvBoolean(
        process.env.OPENAI_TRUST_SCORE_EXPLAINER_ENABLED,
        false
      ),
      vendor_coaching: parseEnvBoolean(process.env.OPENAI_VENDOR_COACHING_ENABLED, false),
    },
  };
}

export function getAiFeatureModel(
  feature: AiFeatureKey,
  snapshot: AiEnvSnapshot = readAiEnv()
): string {
  switch (feature) {
    case "moderation_assistant":
      return snapshot.models.moderationAssistantModel;
    case "dispute_summary_assistant":
      return snapshot.models.disputeSummaryModel;
    case "trust_score_explanations":
      return snapshot.models.trustScoreExplainerModel;
    case "vendor_coaching":
      return snapshot.models.vendorCoachingModel;
    default:
      return snapshot.models.defaultModel;
  }
}

export function isAiConfigured(snapshot: AiEnvSnapshot = readAiEnv()): boolean {
  return Boolean(snapshot.apiKey);
}

let warnedOnce = false;

export function logAiEnvWarnings(): void {
  if (warnedOnce) return;
  warnedOnce = true;

  const env = readAiEnv();
  const lines: string[] = [];

  if (env.enabled && !env.apiKey) {
    lines.push("OPENAI_ENABLED is true but OPENAI_API_KEY is missing.");
  }
  if (env.enabled && !env.projectId) {
    lines.push("OPENAI_ENABLED is true but OPENAI_PROJECT_ID is missing.");
  }
  if (!env.enabled && Object.values(env.features).some(Boolean)) {
    lines.push("One or more AI feature flags are enabled while OPENAI_ENABLED is false.");
  }
  if (env.timeoutMs < 10_000) {
    lines.push("OPENAI_TIMEOUT_MS is set below 10000ms; short timeouts may create noisy retries.");
  }
  if (!env.models.defaultModel) {
    lines.push("OPENAI_DEFAULT_MODEL is empty.");
  }

  if (lines.length) {
    console.warn("[ai-config] Configuration warnings:\n- " + lines.join("\n- "));
  }
}
