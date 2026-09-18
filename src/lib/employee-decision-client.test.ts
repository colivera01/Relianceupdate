import { describe, expect, it } from "vitest";

import { buildEmployeeDecisionSubmission } from "@/lib/employee-decision-client";

describe("Employee decision client contract", () => {
  it("submits the exact displayed V2 context hash with the participation choice", () => {
    expect(buildEmployeeDecisionSubmission({
      membershipId: "membership-1",
      decision: "ALLOW",
      contextHash: "a".repeat(64),
    })).toEqual({
      membershipId: "membership-1",
      decision: "ALLOW",
      contextHash: "a".repeat(64),
    });
  });

  it("preserves the historical decision body when no context hash applies", () => {
    expect(buildEmployeeDecisionSubmission({
      membershipId: "membership-1",
      decision: "DENY",
    })).toEqual({
      membershipId: "membership-1",
      decision: "DENY",
    });
  });
});
