import { describe, expect, it } from "vitest";
import {
  INTERNAL_AUDIT_USER_IDS,
  LEGACY_BETA_TEST_EMPLOYEE_USER_ID,
  isOwnerAdminUserId,
  internalUserNotClauses,
} from "@/lib/internal-identities";

describe("internal identity classification", () => {
  it("preserves the legacy beta Employee exclusion without classifying it as Admin", () => {
    expect(isOwnerAdminUserId(LEGACY_BETA_TEST_EMPLOYEE_USER_ID)).toBe(false);
    expect(INTERNAL_AUDIT_USER_IDS).toContain(LEGACY_BETA_TEST_EMPLOYEE_USER_ID);
    expect(internalUserNotClauses()).toContainEqual({
      id: LEGACY_BETA_TEST_EMPLOYEE_USER_ID,
    });
  });
});
