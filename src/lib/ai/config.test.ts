import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiFeatureModel, logAiEnvWarnings, readAiEnv } from "./config";
import { getAiFeatureFlags, isAiFeatureEnabled } from "./feature-flags";

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  setEnv({
    OPENAI_API_KEY: undefined,
    OPENAI_PROJECT_ID: undefined,
    OPENAI_ENABLED: undefined,
    OPENAI_AUDIT_LOGGING_ENABLED: undefined,
    OPENAI_DEFAULT_MODEL: undefined,
    OPENAI_TIMEOUT_MS: undefined,
    OPENAI_MAX_RETRIES: undefined,
    OPENAI_MODERATION_ASSISTANT_ENABLED: undefined,
    OPENAI_DISPUTE_SUMMARY_ENABLED: undefined,
    OPENAI_TRUST_SCORE_EXPLAINER_ENABLED: undefined,
    OPENAI_VENDOR_COACHING_ENABLED: undefined,
    OPENAI_VENDOR_APPROVAL_ASSISTANT_ENABLED: undefined,
    OPENAI_REVIEW_MODERATION_ASSISTANT_ENABLED: undefined,
    OPENAI_PUBLISH_READINESS_ASSISTANT_ENABLED: undefined,
    OPENAI_PROMOTIONS_ASSISTANT_ENABLED: undefined,
    OPENAI_VENDOR_COPY_ASSISTANT_ENABLED: undefined,
    OPENAI_JOB_RECOVERY_ASSISTANT_ENABLED: undefined,
    OPENAI_SUPPORT_INBOX_TRIAGE_ENABLED: undefined,
    OPENAI_MODERATION_ASSISTANT_MODEL: undefined,
    OPENAI_DISPUTE_SUMMARY_MODEL: undefined,
    OPENAI_VENDOR_APPROVAL_ASSISTANT_MODEL: undefined,
    OPENAI_REVIEW_MODERATION_ASSISTANT_MODEL: undefined,
    OPENAI_PUBLISH_READINESS_ASSISTANT_MODEL: undefined,
    OPENAI_PROMOTIONS_ASSISTANT_MODEL: undefined,
    OPENAI_VENDOR_COPY_ASSISTANT_MODEL: undefined,
    OPENAI_JOB_RECOVERY_ASSISTANT_MODEL: undefined,
    OPENAI_SUPPORT_INBOX_TRIAGE_MODEL: undefined,
  });
});

describe("ai config", () => {
  it("reads defaults safely when env vars are unset", () => {
    const env = readAiEnv();
    expect(env.enabled).toBe(false);
    expect(env.auditLoggingEnabled).toBe(true);
    expect(env.models.defaultModel).toBe("gpt-5.4-mini");
    expect(env.timeoutMs).toBe(20_000);
    expect(env.maxRetries).toBe(1);
  });

  it("parses feature flags and feature-specific models", () => {
    setEnv({
      OPENAI_ENABLED: "true",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
      OPENAI_VENDOR_APPROVAL_ASSISTANT_ENABLED: "true",
      OPENAI_PUBLISH_READINESS_ASSISTANT_ENABLED: "true",
      OPENAI_DEFAULT_MODEL: "gpt-5.5",
      OPENAI_DISPUTE_SUMMARY_MODEL: "gpt-5.4-mini",
      OPENAI_VENDOR_APPROVAL_ASSISTANT_MODEL: "gpt-5.3",
      OPENAI_PUBLISH_READINESS_ASSISTANT_MODEL: "gpt-5.2",
    });

    const env = readAiEnv();
    expect(getAiFeatureFlags(env)).toMatchObject({
      moderation_assistant: true,
      dispute_summary_assistant: false,
      vendor_approval_assistant: true,
      publish_readiness_assistant: true,
    });
    expect(isAiFeatureEnabled("moderation_assistant", env)).toBe(true);
    expect(getAiFeatureModel("moderation_assistant", env)).toBe("gpt-5.5");
    expect(getAiFeatureModel("dispute_summary_assistant", env)).toBe("gpt-5.4-mini");
    expect(getAiFeatureModel("vendor_approval_assistant", env)).toBe("gpt-5.3");
    expect(getAiFeatureModel("publish_readiness_assistant", env)).toBe("gpt-5.2");
  });

  it("warns when feature flags are enabled while OpenAI is globally disabled", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setEnv({
      OPENAI_ENABLED: "false",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
    });

    logAiEnvWarnings();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("One or more AI feature flags are enabled");
  });
});
