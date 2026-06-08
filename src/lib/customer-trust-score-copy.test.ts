import { describe, expect, it } from "vitest";

import { getCustomerTrustScoreCopy } from "@/lib/customer-trust-score-copy";

describe("customer-trust-score-copy", () => {
  it("shows the scored percentage when a trust score exists", () => {
    expect(
      getCustomerTrustScoreCopy({
        hasPublicMedia: true,
        reviewCount: 2,
        trustScore: {
          scored: true,
          totalScorePct: 98,
          maturityState: "established",
          evidence: { verifiedBookings: 12, approvedServiceVideos: 8, validatedDisputes: 0 },
        },
      })
    ).toEqual({
      label: "Reliance Trust Score",
      headline: "98%",
      detail: "12 verified bookings on record",
      tone: "strong",
      emphasis: "strong",
    });
  });

  it("shows early-stage score wording when a score exists with limited verified activity", () => {
    expect(
      getCustomerTrustScoreCopy({
        hasPublicMedia: true,
        reviewCount: 0,
        trustScore: {
          scored: true,
          totalScorePct: 100,
          maturityState: "early_stage",
          evidence: { verifiedBookings: 1, approvedServiceVideos: 1, validatedDisputes: 0 },
        },
      })
    ).toEqual({
      label: "Early-stage Trust Score",
      headline: "100%",
      detail: "1 verified booking so far",
      tone: "calm",
      emphasis: "subtle",
    });
  });

  it("shows early-stage operational wording when public media exists without a score", () => {
    expect(
      getCustomerTrustScoreCopy({
        hasPublicMedia: true,
        reviewCount: 0,
        trustScore: { scored: false, totalScorePct: null },
      })
    ).toEqual({
      label: "Early trust signal",
      headline: "Service video on file",
      detail: "Approved public service video available",
      tone: "calm",
      emphasis: "subtle",
    });
  });

  it("shows early-stage wording for vendors with public reviews but no score", () => {
    expect(
      getCustomerTrustScoreCopy({
        hasPublicMedia: false,
        reviewCount: 3,
        trustScore: { scored: false, totalScorePct: null },
      })
    ).toEqual({
      label: "Public reviews",
      headline: "3 reviews",
      detail: "Customer feedback is live",
      tone: "balanced",
      emphasis: "standard",
    });
  });

  it("falls back to a truthful new-profile state", () => {
    expect(
      getCustomerTrustScoreCopy({
        hasPublicMedia: false,
        reviewCount: 0,
        trustScore: { scored: false, totalScorePct: null },
      })
    ).toEqual({
      label: "Trust Score building",
      headline: "Trust signals building",
      detail: "More verified completed work will add public trust context",
      tone: "muted",
      emphasis: "subtle",
    });
  });
});
