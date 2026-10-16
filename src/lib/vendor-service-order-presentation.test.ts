import { describe, expect, it } from "vitest";
import { resolveVendorServiceOrderPresentation } from "./vendor-service-order-presentation";

describe("resolveVendorServiceOrderPresentation", () => {
  it("describes an exact current pre-gate release without contradictory attestation copy", () => {
    const presentation = resolveVendorServiceOrderPresentation({
      serviceOrderCurrent: true,
      serviceOrderAnyReleased: true,
      managerAttestationCurrent: false,
    });

    expect(presentation).toMatchObject({
      serviceOrderSent: true,
      actionLabel: "Resend current Service Order link",
      attestationMode: "GRANDFATHERED_CURRENT_RELEASE",
      attestationTitle: "Service Order sent and current",
    });
    expect(presentation.attestationDetail).not.toContain(
      "required before Service Order release",
    );
  });

  it("requires attestation copy for a stale prior release", () => {
    expect(
      resolveVendorServiceOrderPresentation({
        serviceOrderCurrent: false,
        serviceOrderAnyReleased: true,
        managerAttestationCurrent: false,
      }),
    ).toMatchObject({
      serviceOrderSent: false,
      actionLabel: "Send updated Service Order",
      attestationMode: "REQUIRED_FOR_RELEASE",
    });
  });

  it("keeps a never-released Service Order in the initial-send state", () => {
    expect(
      resolveVendorServiceOrderPresentation({
        serviceOrderCurrent: false,
        serviceOrderAnyReleased: false,
        managerAttestationCurrent: false,
      }),
    ).toMatchObject({
      serviceOrderSent: false,
      actionLabel: "Send Service Order",
      attestationMode: "REQUIRED_FOR_RELEASE",
    });
  });
});
