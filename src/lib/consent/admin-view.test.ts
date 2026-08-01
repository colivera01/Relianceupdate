import { describe, expect, it } from "vitest";

import { parseRedactedPermissionMetadata, redactPermissionAuditValue } from "./admin-view";

describe("permission admin evidence redaction", () => {
  it("removes secret-bearing fields recursively", () => {
    expect(
      redactPermissionAuditValue({
        generation: 2,
        token: "raw",
        nested: { code: "123456", status: "sent", consentUrl: "https://example.test/secret" },
      })
    ).toEqual({ generation: 2, nested: { status: "sent" } });
  });

  it("withholds unstructured metadata rather than echoing it", () => {
    expect(parseRedactedPermissionMetadata("not-json-with-a-secret")).toBe(
      "[unstructured metadata withheld]"
    );
  });
});
