type NumericLike = number | null | undefined;

export type PublicTrustMaturityState =
  | "not_ready"
  | "early_stage"
  | "emerging"
  | "established";

export type PublicTrustTone = "muted" | "calm" | "balanced" | "strong";

export interface PublicTrustEvidenceSummary {
  verifiedBookings: number;
  approvedServiceVideos: number;
  validatedDisputes: number;
}

export interface PublicTrustPresentationSummary {
  maturityState: PublicTrustMaturityState;
  maturityLabel: string;
  title: string;
  scoreDisplay: string | null;
  summary: string;
  tone: PublicTrustTone;
  scoreEmphasis: "subtle" | "standard" | "strong";
}

export interface PublicTrustPresentationInput {
  totalScorePct?: NumericLike;
  workflowCompletionNumerator?: NumericLike;
  videoVerificationNumerator?: NumericLike;
  disputeFreeNumerator?: NumericLike;
  disputeFreeDenominator?: NumericLike;
}

function num(value: NumericLike): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildPublicTrustEvidenceSummary(
  input: PublicTrustPresentationInput | null | undefined
): PublicTrustEvidenceSummary {
  const verifiedBookings = num(input?.workflowCompletionNumerator);
  const approvedServiceVideos = num(input?.videoVerificationNumerator);
  const disputeFreeNumerator = num(input?.disputeFreeNumerator);
  const disputeFreeDenominator = num(input?.disputeFreeDenominator);

  return {
    verifiedBookings,
    approvedServiceVideos,
    validatedDisputes: Math.max(0, disputeFreeDenominator - disputeFreeNumerator),
  };
}

/**
 * Presentation-only maturity thresholds. These do not change score calculations,
 * formulas, weights, or publication rules; they only help customers interpret how
 * mature a visible score feels.
 */
export function getPublicTrustMaturityState(
  input: PublicTrustPresentationInput | null | undefined
): PublicTrustMaturityState {
  const totalScorePct =
    typeof input?.totalScorePct === "number" && Number.isFinite(input.totalScorePct)
      ? input.totalScorePct
      : null;

  if (totalScorePct === null) return "not_ready";

  const evidence = buildPublicTrustEvidenceSummary(input);

  if (evidence.verifiedBookings >= 6 || evidence.approvedServiceVideos >= 3) {
    return "established";
  }

  if (evidence.verifiedBookings >= 3 || evidence.approvedServiceVideos >= 2) {
    return "emerging";
  }

  return "early_stage";
}

export function buildPublicTrustPresentationSummary(
  input: PublicTrustPresentationInput | null | undefined
): PublicTrustPresentationSummary {
  const totalScorePct =
    typeof input?.totalScorePct === "number" && Number.isFinite(input.totalScorePct)
      ? Math.round(input.totalScorePct)
      : null;
  const maturityState = getPublicTrustMaturityState(input);

  if (maturityState === "not_ready" || totalScorePct === null) {
    return {
      maturityState: "not_ready",
      maturityLabel: "Building",
      title: "Trust Score building",
      scoreDisplay: null,
      summary: "More verified completed work is needed before a public Trust Score appears.",
      tone: "muted",
      scoreEmphasis: "subtle",
    };
  }

  if (maturityState === "early_stage") {
    return {
      maturityState,
      maturityLabel: "Early Stage",
      title: "Early-stage Trust Score",
      scoreDisplay: `${totalScorePct}%`,
      summary: `${totalScorePct}% based on limited verified activity`,
      tone: "calm",
      scoreEmphasis: "subtle",
    };
  }

  if (maturityState === "emerging") {
    return {
      maturityState,
      maturityLabel: "Emerging",
      title: "Emerging Trust Score",
      scoreDisplay: `${totalScorePct}%`,
      summary: `${totalScorePct}% with growing verified activity`,
      tone: "balanced",
      scoreEmphasis: "standard",
    };
  }

  return {
    maturityState: "established",
    maturityLabel: "Established",
    title: "Reliance Trust Score",
    scoreDisplay: `${totalScorePct}%`,
    summary: `${totalScorePct}% based on a strong history of verified completed work`,
    tone: "strong",
    scoreEmphasis: "strong",
  };
}
