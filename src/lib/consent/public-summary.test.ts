import { describe, expect, it } from "vitest";

import { buildIdentitySafePermissionSummary } from "./public-summary";

describe("public permission summary", () => {
  it("returns useful context without recipient details or secrets", () => {
    const summary = buildIdentitySafePermissionSummary({
      id: "consent-1",
      status: "requested",
      expiresAt: new Date("2026-08-02T12:00:00.000Z"),
      linkSecret: "must-not-leak",
      recipientEmail: "person@example.com",
      recipientPhone: "+14075550124",
      vendorName: "Electro LLC",
      serviceName: "Outlet Installation",
      scheduledFor: new Date("2026-08-02T14:00:00.000Z"),
      recordingLocation: "residence",
      audioEnabled: false,
      recipientEmailMasked: "p***@example.com",
      recipientPhoneMasked: "+1 *** *** 0124",
    });

    expect(summary).not.toHaveProperty("linkSecret");
    expect(summary).not.toHaveProperty("recipientEmail");
    expect(summary).not.toHaveProperty("recipientPhone");
    expect(summary).toMatchObject({
      id: "consent-1",
      vendorName: "Electro LLC",
      serviceName: "Outlet Installation",
      audioEnabled: false,
      initialAudience: "private",
    });
  });
});
