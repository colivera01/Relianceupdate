import { describe, expect, it } from "vitest";
import { resolveOperationalPhase } from "./vendor-job-operational-phase";

describe("resolveOperationalPhase", () => {
  it("keeps manager-approved staged packages in moderator review until all stages are approved", () => {
    expect(
      resolveOperationalPhase({
        bookingStatus: "COMPLETED",
        customerMetadata: JSON.stringify({ reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" } }),
        linkedMediaCount: 3,
        assignedEmployees: ["Bradley Coopers"],
        hasCompleteStagedPackage: true,
        hasAdminApprovedStagedPackage: false,
      })
    ).toBe("AWAITING_ADMIN_REVIEW");
  });

  it("marks completed staged packages complete after all required stages are moderation-approved", () => {
    expect(
      resolveOperationalPhase({
        bookingStatus: "COMPLETED",
        customerMetadata: JSON.stringify({ reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" } }),
        linkedMediaCount: 3,
        assignedEmployees: ["Bradley Coopers"],
        hasCompleteStagedPackage: true,
        hasAdminApprovedStagedPackage: true,
      })
    ).toBe("COMPLETED");
  });
});
