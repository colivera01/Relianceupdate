export type ServiceVideoPublicState = "PRIVATE" | "PUBLIC_REVIEW_PENDING" | "PUBLIC";

export function resolveServiceVideoPublicState(input: {
  proposalStatus?: string | null;
  activePublicEligibilityCount?: number;
  publicationWithdrawn?: boolean;
}): ServiceVideoPublicState {
  if (input.publicationWithdrawn) return "PRIVATE";
  if (Number(input.activePublicEligibilityCount || 0) > 0 && String(input.proposalStatus || "").toUpperCase() === "PUBLIC") {
    return "PUBLIC";
  }
  if ([
    "AWAITING_PARTICIPANT_DECISIONS",
    "AWAITING_ADMIN_REVIEW",
    "ADMIN_FLAGGED",
  ].includes(String(input.proposalStatus || "").toUpperCase())) {
    return "PUBLIC_REVIEW_PENDING";
  }
  return "PRIVATE";
}

export function vendorPublicationWithdrawalCopy(state: ServiceVideoPublicState): {
  label: string;
  detail: string;
} {
  if (state === "PUBLIC") {
    return {
      label: "Remove from Public view",
      detail: "Restrict the currently Public package and preserve the withdrawal evidence.",
    };
  }
  if (state === "PUBLIC_REVIEW_PENDING") {
    return {
      label: "Withdraw from Public review",
      detail: "Prevent this package from becoming Public while preserving its review history.",
    };
  }
  return {
    label: "Prevent future Public sharing",
    detail: "Record a restriction so this work record cannot become Public later.",
  };
}
