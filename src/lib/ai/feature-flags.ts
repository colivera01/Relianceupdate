import { type AiEnvSnapshot, type AiFeatureFlags, type AiFeatureKey, readAiEnv } from "./config";

export type { AiFeatureFlags, AiFeatureKey } from "./config";

export function getAiFeatureFlags(snapshot: AiEnvSnapshot = readAiEnv()): AiFeatureFlags {
  return { ...snapshot.features };
}

export function isAiFeatureEnabled(
  feature: AiFeatureKey,
  snapshot: AiEnvSnapshot = readAiEnv()
): boolean {
  return snapshot.enabled && snapshot.features[feature];
}
