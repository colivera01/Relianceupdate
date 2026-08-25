import { describe, expect, it } from "vitest";
import { getPermissionRefreshFeedback, resolveVendorJobLifecyclePresentation } from "./vendor-job-lifecycle-presentation";

describe("vendor job lifecycle presentation", () => {
  it("prioritizes canceled lifecycle over recording blocks", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "CANCELED",
      permissionRequired: true,
      permissionState: "PENDING",
      assigned: true,
    });
    expect(state.label).toBe("Service Order canceled");
    expect(state.detail).toContain("permanently closed");
  });

  it("identifies a decline-canceled Reliance work record without canceling the underlying service", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "CANCELED",
      permissionRequired: true,
      permissionState: "DECLINED",
    });

    expect(state.label).toBe("Recording Declined - Reliance Work Record Canceled");
    expect(state.detail).toContain("underlying service arrangement is separate");
    expect(state.responsibleParticipant).toBe("No participant needs to act in Reliance");
  });

  it("uses one truthful waiting state and a plain-language refresh action", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "PENDING",
      locationSelected: true,
      permissionRequired: true,
      permissionState: "PENDING",
      hasCustomerContact: true,
      consentRecipientLabel: "c***@example.com",
    });
    expect(state.label).toBe("Waiting for customer permission");
    expect(state.actionLabel).toBe("Refresh Permission Status");
    expect(state.detail).toContain("No decision has been recorded");
  });

  it("keeps manager review authoritative", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "AWAITING_REVIEW",
      permissionState: "ALLOWED",
      serviceOrderSent: true,
    });
    expect(state.label).toBe("Awaiting Manager Review");
    expect(state.responsibleParticipant).toBe("Vendor manager");
  });

  it("distinguishes terminal Reliance Admin rejection from historical rejection", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "REJECTED",
      operationalPhase: "REJECTED",
      adminAuditDecision: "REJECT",
      adminAuditRejectionCategory: "UNVERIFIABLE",
      adminAuditRejectionReason: "The submitted evidence could not be verified.",
    });

    expect(state.label).toBe("Reliance Audit Failed");
    expect(state.detail).toContain("cannot be rerecorded");
    expect(state.detail).toContain("UNVERIFIABLE");
    expect(state.responsibleParticipant).toBe("No participant needs to act");
  });

  it("presents Admin PASS as final Private Proof release without implying Public approval", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "COMPLETED",
      operationalPhase: "COMPLETED",
      adminAuditDecision: "PASS",
      adminAuditDecidedAt: "2026-08-24T22:00:00.000Z",
      allVideosPresent: true,
    });

    expect(state.label).toBe("Reliance Audit Passed");
    expect(state.detail).toContain("Private Proof");
    expect(state.detail).toContain("does not make any video Public");
    expect(state.label).not.toBe("All videos uploaded");
  });

  it("shows service-order sent only as a read-only state", () => {
    const state = resolveVendorJobLifecyclePresentation({
      status: "CONFIRMED",
      locationSelected: true,
      permissionRequired: false,
      assigned: true,
      serviceOrderSent: true,
      nextStageLabel: "Starting Condition",
    });
    expect(state.label).toBe("Service Order Sent");
    expect(state.actionLabel).toBe("Service Order Sent");
  });

  it.each([
    ["pending", "info", "Still waiting for customer permission."],
    ["allowed", "success", "Customer permission approved."],
    ["declined", "warning", "Customer declined recording."],
    ["wrong_recipient", "warning", "Recording request reported as wrong recipient."],
  ])("maps %s permission refresh feedback truthfully", (state, tone, message) => {
    expect(getPermissionRefreshFeedback(state)).toEqual({ tone, message });
  });
});
