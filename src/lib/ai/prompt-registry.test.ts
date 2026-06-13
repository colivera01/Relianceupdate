import { describe, expect, it } from "vitest";
import {
  AI_PROMPT_CATALOG,
  DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION,
  JOB_RECOVERY_ASSISTANT_PROMPT_VERSION,
  MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION,
  PROMOTIONS_ASSISTANT_PROMPT_VERSION,
  PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION,
  REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION,
  SUPPORT_INBOX_TRIAGE_PROMPT_VERSION,
  VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION,
  VENDOR_COPY_ASSISTANT_PROMPT_VERSION,
  VENDOR_COACHING_SUMMARY_PROMPT_VERSION,
  readAiPromptCatalog,
} from "./prompt-registry";

describe("AI prompt registry", () => {
  it("lists the current AI and deterministic inventory", () => {
    expect(AI_PROMPT_CATALOG.map((entry) => entry.feature)).toEqual([
      "moderation_assistant",
      "dispute_summary_assistant",
      "trust_score_explanations",
      "vendor_coaching",
      "vendor_approval_assistant",
      "review_moderation_assistant",
      "publish_readiness_assistant",
      "promotions_assistant",
      "vendor_copy_assistant",
      "job_recovery_assistant",
      "support_inbox_triage",
    ]);
  });

  it("keeps current prompt versions stable in one central file", () => {
    expect(MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION).toBe("media-package-metadata-v1");
    expect(DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION).toBe("content-report-case-v1");
    expect(VENDOR_COACHING_SUMMARY_PROMPT_VERSION).toBe("vendor-coaching-summary-v1");
    expect(VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION).toBe("vendor-approval-review-v1");
    expect(REVIEW_MODERATION_ASSISTANT_PROMPT_VERSION).toBe("review-moderation-v1");
    expect(PUBLISH_READINESS_ASSISTANT_PROMPT_VERSION).toBe("publish-readiness-v1");
    expect(PROMOTIONS_ASSISTANT_PROMPT_VERSION).toBe("promotion-readiness-v1");
    expect(VENDOR_COPY_ASSISTANT_PROMPT_VERSION).toBe("vendor-copy-v1");
    expect(JOB_RECOVERY_ASSISTANT_PROMPT_VERSION).toBe("job-recovery-v1");
    expect(SUPPORT_INBOX_TRIAGE_PROMPT_VERSION).toBe("support-inbox-triage-v1");
  });

  it("returns a copy of the prompt catalog", () => {
    const catalog = readAiPromptCatalog();
    expect(catalog).toHaveLength(11);
    expect(catalog).not.toBe(AI_PROMPT_CATALOG);
  });
});
