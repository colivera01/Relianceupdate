export type VendorRecordingNoticeTone = "info" | "warning" | "error";

export type VendorRecordingNoticePresentation = {
  tone: VendorRecordingNoticeTone;
  title: string;
  detail: string;
  reviewContact: boolean;
};

export function resolveVendorRecordingNoticePresentation(
  notification: { status?: unknown; lastError?: unknown } | null | undefined,
): VendorRecordingNoticePresentation | null {
  const status = String(notification?.status || "").trim().toUpperCase();

  if (!status || status === "SENT") return null;

  if (status === "FAILED") {
    return {
      tone: "error",
      title: "Customer recording notice needs attention",
      detail: "No delivery was confirmed. Check the saved customer email and mobile phone. Reliance will keep the notice queued for retry.",
      reviewContact: true,
    };
  }

  if (status === "PARTIAL") {
    return {
      tone: "warning",
      title: "Customer recording notice partly delivered",
      detail: "At least one channel succeeded, but another did not. Check the saved customer contact before the service.",
      reviewContact: true,
    };
  }

  return {
    tone: "info",
    title: "Customer recording notice is being delivered",
    detail: "Reliance is processing the informational notice. No customer response is required for this recording scope.",
    reviewContact: false,
  };
}
