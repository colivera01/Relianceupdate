import { readAiEnv, type AiFeatureKey } from "./config";
import { formatAiFeatureLabel } from "./reporting";

export type AiFeatureRolloutStatus = {
  feature: AiFeatureKey;
  label: string;
  enabled: boolean;
  model: string;
};

export type AiRolloutStatusSnapshot = {
  platformEnabled: boolean;
  projectConfigured: boolean;
  apiKeyConfigured: boolean;
  auditLoggingEnabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  defaultModel: string;
  enabledFeatureCount: number;
  featureStatuses: AiFeatureRolloutStatus[];
};

function modelForFeature(feature: AiFeatureKey, models: ReturnType<typeof readAiEnv>["models"]): string {
  switch (feature) {
    case "moderation_assistant":
      return models.moderationAssistantModel;
    case "dispute_summary_assistant":
      return models.disputeSummaryModel;
    case "trust_score_explanations":
      return models.trustScoreExplainerModel;
    case "vendor_coaching":
      return models.vendorCoachingModel;
    case "vendor_approval_assistant":
      return models.vendorApprovalAssistantModel;
    case "review_moderation_assistant":
      return models.reviewModerationAssistantModel;
    case "publish_readiness_assistant":
      return models.publishReadinessAssistantModel;
    case "promotions_assistant":
      return models.promotionsAssistantModel;
    case "vendor_copy_assistant":
      return models.vendorCopyAssistantModel;
    case "job_recovery_assistant":
      return models.jobRecoveryAssistantModel;
    case "support_inbox_triage":
      return models.supportInboxTriageModel;
    default:
      return models.defaultModel;
  }
}

export function readAiRolloutStatus(): AiRolloutStatusSnapshot {
  const env = readAiEnv();
  const featureStatuses: AiFeatureRolloutStatus[] = (
    Object.keys(env.features) as AiFeatureKey[]
  ).map((feature) => ({
    feature,
    label: formatAiFeatureLabel(feature),
    enabled: Boolean(env.enabled && env.features[feature]),
    model: modelForFeature(feature, env.models),
  }));

  return {
    platformEnabled: env.enabled,
    projectConfigured: Boolean(env.projectId),
    apiKeyConfigured: Boolean(env.apiKey),
    auditLoggingEnabled: env.auditLoggingEnabled,
    timeoutMs: env.timeoutMs,
    maxRetries: env.maxRetries,
    defaultModel: env.models.defaultModel,
    enabledFeatureCount: featureStatuses.filter((feature) => feature.enabled).length,
    featureStatuses,
  };
}
