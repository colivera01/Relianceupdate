import { describe, expect, it } from "vitest";

import {
  resolveOperationalClientKey,
  resolveOperationalClientLabel,
} from "@/lib/operational-client";

describe("operational client helpers", () => {
  it("collapses duplicated adjacent client labels", () => {
    expect(
      resolveOperationalClientLabel({
        clientName: "E2E Smoke CustomerE2E Smoke Customer",
      })
    ).toBe("E2E Smoke Customer");
  });

  it("prefers user id for stable unique client keys", () => {
    expect(
      resolveOperationalClientKey({
        userId: "user-123",
        email: "customer@example.com",
      })
    ).toBe("user:user-123");
  });

  it("falls back to contact info when there is no linked user id", () => {
    expect(
      resolveOperationalClientKey({
        email: "Customer@example.com",
        phone: "(407) 555-0119",
      })
    ).toBe("email:customer@example.com");
  });
});
