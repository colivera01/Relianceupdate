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
      "More finalized verified activity is needed"
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
      maturityLabel: "Early evidence",
      scoreDisplay: "100/100",
      summary: "Performance across 1 verified completed job. Early evidence describes record volume, not score quality.",
    });
  });

  it("classifies growing history as emerging", () => {
    expect(
      buildPublicTrustPresentationSummary({
        totalScorePct: 96,
        workflowCompletionNumerator: 5,
        videoVerificationNumerator: 3,
        disputeFreeNumerator: 5,
        disputeFreeDenominator: 5,
      })
    ).toMatchObject({
      maturityState: "emerging",
      maturityLabel: "Emerging evidence",
      summary: "Performance across 5 verified completed jobs. Emerging evidence describes record volume, not score quality.",
    });
  });

  it("classifies stronger operational history as established", () => {
    expect(
      buildPublicTrustPresentationSummary({
        totalScorePct: 94,
        workflowCompletionNumerator: 20,
        videoVerificationNumerator: 10,
        disputeFreeNumerator: 20,
        disputeFreeDenominator: 20,
      })
    ).toMatchObject({
      maturityState: "established",
      maturityLabel: "Established evidence",
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
