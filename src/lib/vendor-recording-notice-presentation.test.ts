import { describe, expect, it } from "vitest";

import { resolveVendorRecordingNoticePresentation } from "./vendor-recording-notice-presentation";

describe("vendor recording-notice presentation", () => {
  it("does not add noise after complete delivery", () => {
    expect(resolveVendorRecordingNoticePresentation({ status: "SENT" })).toBeNull();
    expect(resolveVendorRecordingNoticePresentation(null)).toBeNull();
  });

  it("makes failed delivery actionable without treating the notice as permission", () => {
    expect(
      resolveVendorRecordingNoticePresentation({ status: "FAILED", lastError: "sms_delivery_failed" }),
    ).toEqual({
      tone: "error",
      title: "Customer recording notice needs attention",
      detail:
        "No delivery was confirmed. Check the saved customer email and mobile phone. Reliance will keep the notice queued for retry.",
      reviewContact: true,
    });
  });

  it("surfaces partial delivery as a contact-review warning", () => {
    const result = resolveVendorRecordingNoticePresentation({ status: "PARTIAL" });
    expect(result).toMatchObject({ tone: "warning", reviewContact: true });
    expect(result?.detail).toContain("At least one channel succeeded");
  });

  it("shows queued and sending delivery as non-blocking informational state", () => {
    expect(resolveVendorRecordingNoticePresentation({ status: "QUEUED" })).toMatchObject({
      tone: "info",
      reviewContact: false,
    });
    expect(resolveVendorRecordingNoticePresentation({ status: "SENDING" })).toMatchObject({
      tone: "info",
      reviewContact: false,
    });
  });
});
