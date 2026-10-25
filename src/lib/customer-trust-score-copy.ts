type CustomerTrustScoreCopyInput = {
  hasPublicMedia: boolean;
  reviewCount: number | null | undefined;
  trustScore: {
    scored: boolean;
    totalScorePct: number | null;
    maturityState?: "not_ready" | "early_stage" | "emerging" | "established";
    maturityLabel?: string;
    evidence?: {
      verifiedBookings: number;
      approvedServiceVideos: number;
      validatedDisputes: number;
    };
  } | null | undefined;
};

export type CustomerTrustScoreCopy = {
  label: string;
  headline: string;
  detail: string;
  tone: "muted" | "calm" | "balanced" | "strong";
  emphasis: "subtle" | "standard" | "strong";
};

export function getCustomerTrustScoreCopy(
  input: CustomerTrustScoreCopyInput
): CustomerTrustScoreCopy {
  if (input.trustScore?.scored && input.trustScore.totalScorePct !== null) {
    const verifiedBookings = input.trustScore.evidence?.verifiedBookings ?? 0;
    const maturityState = input.trustScore.maturityState || "early_stage";

    if (maturityState === "early_stage") {
      return {
        label: "Early-stage reliability",
        headline: `${input.trustScore.totalScorePct}/100`,
        detail:
          verifiedBookings > 0
            ? `${verifiedBookings} verified booking${verifiedBookings === 1 ? "" : "s"} so far`
            : "Limited verified activity so far",
        tone: "calm",
        emphasis: "subtle",
      };
    }

    if (maturityState === "emerging") {
      return {
        label: "Emerging reliability",
        headline: `${input.trustScore.totalScorePct}/100`,
        detail:
          verifiedBookings > 0
            ? `${verifiedBookings} verified booking${verifiedBookings === 1 ? "" : "s"} and growing`
            : "Growing verified activity",
        tone: "balanced",
        emphasis: "standard",
      };
    }

    return {
      label: "Reliance Trust Score",
      headline: `${input.trustScore.totalScorePct}/100`,
      detail:
        verifiedBookings > 0
          ? `${verifiedBookings} verified booking${verifiedBookings === 1 ? "" : "s"} on record`
          : "Strong verified history",
      tone: "strong",
      emphasis: "strong",
    };
  }

  if (input.hasPublicMedia) {
    return {
      label: "Early reliability signal",
      headline: "Service video on file",
      detail: "Approved public service video available",
      tone: "calm",
      emphasis: "subtle",
    };
  }

  if (typeof input.reviewCount === "number" && input.reviewCount > 0) {
    return {
      label: "Public reviews",
      headline: `${input.reviewCount} review${input.reviewCount === 1 ? "" : "s"}`,
      detail: "Customer feedback is live",
      tone: "balanced",
      emphasis: "standard",
    };
  }

  return {
    label: "Reliability score building",
    headline: "Verified history is building",
    detail: "More finalized Reliance work will add public reliability context",
    tone: "muted",
    emphasis: "subtle",
  };
}
