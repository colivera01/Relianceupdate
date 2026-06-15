export const REVIEW_ATTRIBUTION_TARGETS = [
  "overall_business",
  "assigned_team",
  "scheduling_management",
  "not_sure",
] as const;

export type ReviewAttributionTarget = (typeof REVIEW_ATTRIBUTION_TARGETS)[number];

const DEFAULT_TARGET: ReviewAttributionTarget = "overall_business";

export function normalizeReviewAttributionTarget(value: unknown): ReviewAttributionTarget {
  const normalized = String(value || "").trim().toLowerCase();
  return REVIEW_ATTRIBUTION_TARGETS.includes(normalized as ReviewAttributionTarget)
    ? (normalized as ReviewAttributionTarget)
    : DEFAULT_TARGET;
}

export function shouldAttributeReviewToAssignedTeam(value: unknown): boolean {
  return normalizeReviewAttributionTarget(value) === "assigned_team";
}

export function getReviewAttributionCustomerExplanation(target: ReviewAttributionTarget): string {
  if (target === "assigned_team") {
    return "Your star rating affects the vendor's public business rating. Because you selected the assigned worker or crew, it may also count toward that team member's private performance view.";
  }
  if (target === "scheduling_management") {
    return "Your star rating affects the vendor's public business rating, but it will not be assigned to an individual worker's private score.";
  }
  if (target === "not_sure") {
    return "Your star rating affects the vendor's public business rating. Reliance will not assign it to an individual worker unless the context is clear.";
  }
  return "Your star rating affects the vendor's public business rating. Reliance Trust Score is separate and is based on verified operational activity.";
}
