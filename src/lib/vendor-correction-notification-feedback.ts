export type VendorCorrectionNotificationFeedback = {
  message: string | null;
  warning: string | null;
};

const CORRECTION_SUCCESS_MESSAGE =
  "The selected video stages were returned to the Employee for correction.";
const CORRECTION_DELIVERY_WARNING =
  "The correction was saved, but Reliance could not confirm email or SMS delivery to every assigned Employee. Contact the affected Employee and make sure they reopen their secure Service Order link.";

export function resolveVendorCorrectionNotificationFeedback(
  payload: unknown,
): VendorCorrectionNotificationFeedback {
  const notificationDetails =
    payload && typeof payload === "object"
      ? (payload as {
          details?: {
            notifications?: { sentCount?: unknown; results?: unknown };
          };
        }).details?.notifications
      : null;
  const sentCount = Number(notificationDetails?.sentCount);
  const results = Array.isArray(notificationDetails?.results)
    ? notificationDetails.results
    : null;
  const expectedRecipientCount = results?.length ?? 0;

  if (
    Number.isFinite(sentCount) &&
    sentCount > 0 &&
    expectedRecipientCount > 0 &&
    sentCount === expectedRecipientCount
  ) {
    return { message: CORRECTION_SUCCESS_MESSAGE, warning: null };
  }

  return { message: null, warning: CORRECTION_DELIVERY_WARNING };
}
