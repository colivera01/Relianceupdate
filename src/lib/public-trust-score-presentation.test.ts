import { describe, expect, it } from "vitest";

import {
  buildPublicTrustEvidenceSummary,
  buildPublicTrustPresentationSummary,
  getPublicTrustMaturityState,
} from "@/lib/public-trust-score-presentation";

describe("public-trust-score-presentation", () => {
  it("treats no score as a building state", () => {
    expect(getPublicTrustMaturityState({ totalScorePct: null })).toBe("not_ready");
    expect(buildPublicTrustPresentationSummary({ totalScorePct: null }).summary).toContain(
      "More verified completed work is needed"
    );
  });

  it("classifies thin history as early-stage", () => {
    expect(
      buildPublicTrustPresentationSummary({
        totalScorePct: 100,
        workflowCompletionNumerator: 1,
        videoVerificationNumerator: 1,
        disputeFreeNumerator: 1,
        disputeFreeDenominator: 1,
      })
    ).toMatchObject({
      maturityState: "early_stage",
      maturityLabel: "Early Stage",
      summary: "100% based on limited verified activity",
    });
  });

  it("classifies growing history as emerging", () => {
    expect(
      buildPublicTrustPresentationSummary({
        totalScorePct: 96,
        workflowCompletionNumerator: 3,
        videoVerificationNumerator: 1,
        disputeFreeNumerator: 3,
        disputeFreeDenominator: 3,
      })
    ).toMatchObject({
      maturityState: "emerging",
      maturityLabel: "Emerging",
      summary: "96% with growing verified activity",
    });
  });

  it("classifies stronger operational history as established", () => {
    expect(
      buildPublicTrustPresentationSummary({
        totalScorePct: 94,
        workflowCompletionNumerator: 6,
        videoVerificationNumerator: 3,
        disputeFreeNumerator: 6,
        disputeFreeDenominator: 6,
      })
    ).toMatchObject({
      maturityState: "established",
      maturityLabel: "Established",
      title: "Reliance Trust Score",
    });
  });

  it("surfaces evidence counts from current snapshot fields", () => {
    expect(
      buildPublicTrustEvidenceSummary({
        workflowCompletionNumerator: 4,
        videoVerificationNumerator: 2,
        disputeFreeNumerator: 3,
        disputeFreeDenominator: 4,
      })
    ).toEqual({
      verifiedBookings: 4,
      approvedServiceVideos: 2,
      validatedDisputes: 1,
    });
  });
});
