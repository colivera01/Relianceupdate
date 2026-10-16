export function resolveVendorServiceOrderPresentation(input: {
  serviceOrderCurrent: boolean;
  serviceOrderAnyReleased: boolean;
  managerAttestationCurrent?: boolean;
}) {
  const attestationMode = input.managerAttestationCurrent
    ? "CURRENT"
    : input.serviceOrderCurrent
      ? "GRANDFATHERED_CURRENT_RELEASE"
      : "REQUIRED_FOR_RELEASE";

  return {
    serviceOrderSent: input.serviceOrderCurrent,
    actionLabel: input.serviceOrderCurrent
      ? "Resend current Service Order link"
      : input.serviceOrderAnyReleased
        ? "Send updated Service Order"
        : "Send Service Order",
    actionDescription: input.serviceOrderCurrent
      ? "Redelivers the same current Service Order. It does not change the Employee assignment or recording scope."
      : "Sends the current Service Order after all requirements, including Manager Work Record attestation, are satisfied.",
    attestationMode,
    attestationTitle:
      attestationMode === "GRANDFATHERED_CURRENT_RELEASE"
        ? "Service Order sent and current"
        : null,
    attestationDetail:
      attestationMode === "GRANDFATHERED_CURRENT_RELEASE"
        ? "This Service Order was released before Manager Work Record attestation was introduced. Manager confirmation will be required if the Employee assignment or recording scope changes before another Service Order is released."
        : null,
  } as const;
}
