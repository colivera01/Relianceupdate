import { afterEach, describe, expect, it } from "vitest";
import { readAiRolloutStatus } from "./rollout-status";

const ORIGINAL_ENV = {
  OPENAI_ENABLED: process.env.OPENAI_ENABLED,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_PROJECT_ID: process.env.OPENAI_PROJECT_ID,
  OPENAI_AUDIT_LOGGING_ENABLED: process.env.OPENAI_AUDIT_LOGGING_ENABLED,
  OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
  OPENAI_MAX_RETRIES: process.env.OPENAI_MAX_RETRIES,
  OPENAI_DEFAULT_MODEL: process.env.OPENAI_DEFAULT_MODEL,
  OPENAI_MODERATION_ASSISTANT_ENABLED: process.env.OPENAI_MODERATION_ASSISTANT_ENABLED,
  OPENAI_DISPUTE_SUMMARY_ENABLED: process.env.OPENAI_DISPUTE_SUMMARY_ENABLED,
  OPENAI_TRUST_SCORE_EXPLAINER_ENABLED: process.env.OPENAI_TRUST_SCORE_EXPLAINER_ENABLED,
  OPENAI_VENDOR_COACHING_ENABLED: process.env.OPENAI_VENDOR_COACHING_ENABLED,
  OPENAI_MODERATION_ASSISTANT_MODEL: process.env.OPENAI_MODERATION_ASSISTANT_MODEL,
};

afterEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("readAiRolloutStatus", () => {
  it("derives platform and feature rollout state from env", () => {
    Object.assign(process.env, {
      OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_test",
      OPENAI_AUDIT_LOGGING_ENABLED: "true",
      OPENAI_TIMEOUT_MS: "25000",
      OPENAI_MAX_RETRIES: "2",
      OPENAI_DEFAULT_MODEL: "gpt-5.4-mini",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
      OPENAI_DISPUTE_SUMMARY_ENABLED: "false",
      OPENAI_TRUST_SCORE_EXPLAINER_ENABLED: "false",
      OPENAI_VENDOR_COACHING_ENABLED: "true",
      OPENAI_MODERATION_ASSISTANT_MODEL: "gpt-5.4",
    });

    const snapshot = readAiRolloutStatus();

    expect(snapshot.platformEnabled).toBe(true);
    expect(snapshot.projectConfigured).toBe(true);
    expect(snapshot.apiKeyConfigured).toBe(true);
    expect(snapshot.enabledFeatureCount).toBe(2);
    expect(snapshot.timeoutMs).toBe(25000);
    expect(snapshot.maxRetries).toBe(2);
    expect(snapshot.featureStatuses.find((item) => item.feature === "moderation_assistant"))
      .toMatchObject({ enabled: true, model: "gpt-5.4" });
    expect(snapshot.featureStatuses.find((item) => item.feature === "vendor_coaching"))
      .toMatchObject({ enabled: true });
  });
});
