import { describe, expect, it } from "vitest";

import { resolveVendorCorrectionNotificationFeedback } from "@/lib/vendor-correction-notification-feedback";

describe("vendor correction notification feedback", () => {
  it("preserves the success message when at least one notification was delivered", () => {
    expect(
      resolveVendorCorrectionNotificationFeedback({
        details: { notifications: { sentCount: 1, results: [{ anySuccess: true }] } },
      }),
    ).toEqual({
      message: "The selected video stages were returned to the Employee for correction.",
      warning: null,
    });
  });

  it.each([
    { details: { notifications: { sentCount: 0, results: [{ anySuccess: false }] } } },
    {
      details: {
        notifications: {
          sentCount: 1,
          results: [{ anySuccess: true }, { anySuccess: false }],
        },
      },
    },
    { details: { notifications: { sentCount: 1 } } },
    { details: { notifications: {} } },
    {},
    null,
  ])("warns when delivery cannot be confirmed", (payload) => {
    const feedback = resolveVendorCorrectionNotificationFeedback(payload);

    expect(feedback.message).toBeNull();
    expect(feedback.warning).toContain("could not confirm email or SMS delivery to every assigned Employee");
    expect(feedback.warning).toContain("secure Service Order link");
  });
});
