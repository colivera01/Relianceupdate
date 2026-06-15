import { describe, expect, it } from "vitest";
import {
  getReviewAttributionCustomerExplanation,
  normalizeReviewAttributionTarget,
  shouldAttributeReviewToAssignedTeam,
} from "./review-attribution-intent";

describe("review attribution intent", () => {
  it("defaults unknown values to overall business feedback", () => {
    expect(normalizeReviewAttributionTarget(undefined)).toBe("overall_business");
    expect(normalizeReviewAttributionTarget("bad-value")).toBe("overall_business");
  });

  it("only attributes reviews to team members when the customer explicitly chooses assigned team", () => {
    expect(shouldAttributeReviewToAssignedTeam("assigned_team")).toBe(true);
    expect(shouldAttributeReviewToAssignedTeam("overall_business")).toBe(false);
    expect(shouldAttributeReviewToAssignedTeam("scheduling_management")).toBe(false);
    expect(shouldAttributeReviewToAssignedTeam("not_sure")).toBe(false);
  });

  it("explains that Trust Score is separate from customer ratings", () => {
    expect(getReviewAttributionCustomerExplanation("overall_business")).toContain("Trust Score is separate");
  });
});
