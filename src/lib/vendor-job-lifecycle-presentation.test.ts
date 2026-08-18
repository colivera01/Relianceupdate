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
