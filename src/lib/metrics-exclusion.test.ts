import { describe, expect, it } from "vitest";
import {
  OWNER_ADMIN_EMAIL,
  OWNER_ADMIN_USER_ID,
  SPARKLE_CLEAN_VENDOR_ID,
} from "@/lib/internal-identities";
import {
  countableUserWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";

describe("metrics-exclusion internal/demo segregation", () => {
  it("excludes owner admin user identity from countable users", () => {
    const where = countableUserWhere();
    expect(where.demo).toBe(false);
    const not = where.NOT as Record<string, unknown>[];
    expect(not).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: OWNER_ADMIN_USER_ID }),
        expect.objectContaining({ email: { equals: OWNER_ADMIN_EMAIL } }),
      ])
    );
  });

  it("excludes Sparkle internal demo vendor from countable vendors", () => {
    const where = countableVendorWhere();
    expect(where.demo).toBe(false);
    const not = where.NOT as Record<string, unknown>[];
    expect(not).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: { in: [SPARKLE_CLEAN_VENDOR_ID] } }),
      ])
    );
  });
});
