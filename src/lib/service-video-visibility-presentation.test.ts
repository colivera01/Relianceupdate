import { describe, expect, it } from "vitest";

import {
  resolveServiceVideoPublicState,
  vendorPublicationWithdrawalCopy,
} from "./service-video-visibility-presentation";

describe("Service Video Public governance presentation", () => {
  it("uses prevent-future wording while nothing is Public", () => {
    expect(vendorPublicationWithdrawalCopy(resolveServiceVideoPublicState({}))).toEqual({
      label: "Prevent future Public sharing",
      detail: "Record a restriction so this work record cannot become Public later.",
    });
  });

  it("uses pending-review withdrawal wording before publication", () => {
    const state = resolveServiceVideoPublicState({ proposalStatus: "AWAITING_ADMIN_REVIEW" });
    expect(state).toBe("PUBLIC_REVIEW_PENDING");
    expect(vendorPublicationWithdrawalCopy(state).label).toBe("Withdraw from Public review");
  });

  it("uses remove wording only for canonically Public evidence", () => {
    const state = resolveServiceVideoPublicState({
      proposalStatus: "PUBLIC",
      activePublicEligibilityCount: 3,
    });
    expect(state).toBe("PUBLIC");
    expect(vendorPublicationWithdrawalCopy(state).label).toBe("Remove from Public view");
  });

  it("treats an applied publication withdrawal as Private even if eligibility remains", () => {
    expect(resolveServiceVideoPublicState({
      proposalStatus: "PUBLIC",
      activePublicEligibilityCount: 3,
      publicationWithdrawn: true,
    })).toBe("PRIVATE");
  });
});
