import { describe, expect, it } from "vitest";
import {
  AI_PROMPT_CATALOG,
  DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION,
  MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION,
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
    ]);
  });

  it("keeps current prompt versions stable in one central file", () => {
    expect(MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION).toBe("media-package-metadata-v1");
    expect(DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION).toBe("content-report-case-v1");
    expect(VENDOR_COACHING_SUMMARY_PROMPT_VERSION).toBe("vendor-coaching-summary-v1");
  });

  it("returns a copy of the prompt catalog", () => {
    const catalog = readAiPromptCatalog();
    expect(catalog).toHaveLength(4);
    expect(catalog).not.toBe(AI_PROMPT_CATALOG);
  });
});
