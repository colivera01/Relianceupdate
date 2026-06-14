export type ProofCardKind = "public_proof" | "partial_proof" | "service_offered_only";

export type ProofStageAvailability = {
  startingCondition: boolean;
  workInProgress: boolean;
  finalResult: boolean;
};

export type ProofCardCta = "View Proof" | "View Provider" | "View Service Offered";

export type ProofCard = {
  kind: ProofCardKind;
  headline: string;
  statusLabel: string;
  stageAvailability: ProofStageAvailability;
  reviewLabel: string;
  trustLabel: string;
  evidenceSummary: string;
  primaryCta: ProofCardCta;
};

type TrustScoreInput = {
  scored?: boolean | null;
  totalScorePct?: number | null;
  maturityLabel?: string | null;
  evidence?: {
    verifiedBookings?: number | null;
    approvedServiceVideos?: number | null;
    validatedDisputes?: number | null;
  } | null;
} | null;

export type BuildProofCardInput = {
  serviceName: string;
  vendorName?: string | null;
  stageAvailability?: Partial<ProofStageAvailability> | null;
  hasPublicMedia?: boolean | null;
  reviewCount?: number | null;
  trustScore?: TrustScoreInput;
};

const EMPTY_STAGE_AVAILABILITY: ProofStageAvailability = {
  startingCondition: false,
  workInProgress: false,
  finalResult: false,
};

function normalizeStageAvailability(
  stageAvailability: Partial<ProofStageAvailability> | null | undefined
): ProofStageAvailability {
  return {
    startingCondition: Boolean(stageAvailability?.startingCondition),
    workInProgress: Boolean(stageAvailability?.workInProgress),
    finalResult: Boolean(stageAvailability?.finalResult),
  };
}

function getVerifiedServiceRecordCount(trustScore: TrustScoreInput): number {
  const value = trustScore?.evidence?.verifiedBookings;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function getApprovedServiceVideoCount(trustScore: TrustScoreInput): number {
  const value = trustScore?.evidence?.approvedServiceVideos;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function hasTrustEvidence(trustScore: TrustScoreInput): boolean {
  if (!trustScore) return false;
  if (trustScore.scored && typeof trustScore.totalScorePct === "number" && Number.isFinite(trustScore.totalScorePct)) {
    return true;
  }
  return getVerifiedServiceRecordCount(trustScore) > 0 || getApprovedServiceVideoCount(trustScore) > 0;
}

function buildTrustLabel(trustScore: TrustScoreInput): string {
  if (!trustScore || !hasTrustEvidence(trustScore)) {
    return "Trust Score building";
  }

  const maturity = String(trustScore.maturityLabel || "Trust Score").trim();
  const score =
    typeof trustScore.totalScorePct === "number" && Number.isFinite(trustScore.totalScorePct)
      ? `${Math.round(trustScore.totalScorePct)}%`
      : null;

  return score ? `${maturity}: ${score}` : maturity;
}

function buildEvidenceSummary(input: {
  kind: ProofCardKind;
  reviewCount: number;
  trustScore: TrustScoreInput;
  stageAvailability: ProofStageAvailability;
}): string {
  const verifiedRecords = getVerifiedServiceRecordCount(input.trustScore);
  const approvedVideos = getApprovedServiceVideoCount(input.trustScore);
  const pieces: string[] = [];

  if (verifiedRecords > 0) {
    pieces.push(`${verifiedRecords} verified service ${verifiedRecords === 1 ? "record" : "records"}`);
  }
  if (approvedVideos > 0) {
    pieces.push(`${approvedVideos} approved public service ${approvedVideos === 1 ? "video" : "videos"}`);
  }
  if (input.reviewCount > 0) {
    pieces.push(`${input.reviewCount} public ${input.reviewCount === 1 ? "review" : "reviews"}`);
  }

  if (pieces.length > 0) return `Based on ${pieces.join(", ")}.`;

  if (input.kind === "service_offered_only") {
    return "This work type is listed, but public proof is still building.";
  }

  if (input.stageAvailability.finalResult) {
    return "Approved final-result proof is available.";
  }

  return "Public proof is still building.";
}

export function buildProofCard(input: BuildProofCardInput): ProofCard {
  const stageAvailability = normalizeStageAvailability(input.stageAvailability || EMPTY_STAGE_AVAILABILITY);
  const trustScore = input.trustScore || null;
  const reviewCount =
    typeof input.reviewCount === "number" && Number.isFinite(input.reviewCount) && input.reviewCount > 0
      ? Math.round(input.reviewCount)
      : 0;
  const hasAnyStageProof =
    stageAvailability.startingCondition || stageAvailability.workInProgress || stageAvailability.finalResult;
  const hasCompletedPublicProof = stageAvailability.finalResult;
  const hasReviewOrTrustEvidence = reviewCount > 0 || hasTrustEvidence(trustScore);
  const kind: ProofCardKind = hasCompletedPublicProof
    ? "public_proof"
    : hasAnyStageProof || hasReviewOrTrustEvidence || Boolean(input.hasPublicMedia)
      ? "partial_proof"
      : "service_offered_only";

  const primaryCta: ProofCardCta =
    kind === "public_proof" || kind === "partial_proof"
      ? "View Proof"
      : "View Service Offered";

  const reviewLabel =
    reviewCount > 0
      ? reviewCount === 1
        ? "Review Available"
        : `${reviewCount} Reviews Available`
      : "No Public Review Yet";

  return {
    kind,
    headline: input.serviceName || "Service Offered",
    statusLabel:
      kind === "public_proof"
        ? "Completed Service"
        : kind === "partial_proof"
          ? "Proof Building"
          : "Service Offered",
    stageAvailability,
    reviewLabel,
    trustLabel: buildTrustLabel(trustScore),
    evidenceSummary: buildEvidenceSummary({
      kind,
      reviewCount,
      trustScore,
      stageAvailability,
    }),
    primaryCta,
  };
}
