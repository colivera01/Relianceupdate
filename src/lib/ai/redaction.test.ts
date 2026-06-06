import { describe, expect, it } from "vitest";
import { redactTextForAiAudit, redactValueForAiAudit } from "./redaction";

describe("ai redaction", () => {
  it("redacts common PII and secrets from audit text", () => {
    const redacted = redactTextForAiAudit(
      "Contact cesar@example.com or 407-555-1212 with Bearer abc123 and sk-test-secret-123456789."
    );

    expect(redacted).toContain("c***@example.com");
    expect(redacted).toContain("[redacted_phone]");
    expect(redacted).toContain("Bearer [redacted_token]");
    expect(redacted).toContain("[redacted_openai_key]");
  });

  it("redacts nested objects recursively", () => {
    const value = redactValueForAiAudit({
      customer: {
        email: "avery@example.net",
        notes: "Call me at (555) 111-2222",
      },
      tokens: ["sk-secret-123456789", "Bearer xyz"],
    }) as Record<string, unknown>;

    expect(JSON.stringify(value)).toContain("a***@example.net");
    expect(JSON.stringify(value)).toContain("[redacted_phone]");
    expect(JSON.stringify(value)).toContain("[redacted_openai_key]");
  });
});
