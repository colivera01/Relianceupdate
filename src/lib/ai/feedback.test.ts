import { describe, expect, it } from "vitest";
import {
  inferModerationFeedbackOutcome,
  isAiOperatorFeedbackOutcome,
  moderationActionToActionFamily,
  moderationDecisionToRecommendedAction,
} from "./feedback";

describe("ai feedback helpers", () => {
  it("maps moderation decisions to stable recommended action families", () => {
    expect(moderationDecisionToRecommendedAction("approve")).toBe("approve");
    expect(moderationDecisionToRecommendedAction("flag")).toBe("flag");
    expect(moderationDecisionToRecommendedAction("reject")).toBe("reject");
    expect(moderationDecisionToRecommendedAction("needs_human_review")).toBe(
      "needs_human_review"
    );
  });

  it("normalizes moderation actions to action families", () => {
    expect(moderationActionToActionFamily("approve_public")).toBe("approve");
    expect(moderationActionToActionFamily("set_visibility_private")).toBe("approve");
    expect(moderationActionToActionFamily("reject")).toBe("reject");
    expect(moderationActionToActionFamily("flag")).toBe("flag");
  });

  it("treats matching moderation actions as accepted", () => {
    expect(inferModerationFeedbackOutcome("approve", "approve_public")).toBe("accepted");
    expect(inferModerationFeedbackOutcome("reject", "reject")).toBe("accepted");
    expect(inferModerationFeedbackOutcome("flag", "flag")).toBe("accepted");
  });

  it("treats conflicting moderation actions as overrode", () => {
    expect(inferModerationFeedbackOutcome("approve", "reject")).toBe("overrode");
    expect(inferModerationFeedbackOutcome("reject", "approve_private")).toBe("overrode");
    expect(inferModerationFeedbackOutcome("flag", "approve_customer_only")).toBe("overrode");
  });

  it("handles needs_human_review conservatively", () => {
    expect(inferModerationFeedbackOutcome("needs_human_review", "flag")).toBe("accepted");
    expect(inferModerationFeedbackOutcome("needs_human_review", "reject")).toBe("accepted");
    expect(inferModerationFeedbackOutcome("needs_human_review", "approve_public")).toBe(
      "overrode"
    );
  });

  it("validates supported feedback outcomes", () => {
    expect(isAiOperatorFeedbackOutcome("accepted")).toBe(true);
    expect(isAiOperatorFeedbackOutcome("overrode")).toBe(true);
    expect(isAiOperatorFeedbackOutcome("ignored")).toBe(true);
    expect(isAiOperatorFeedbackOutcome("helpful")).toBe(false);
  });
});
