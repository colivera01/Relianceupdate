import { describe, expect, it } from "vitest";
import { resolveVendorPermissionExpiryRisk } from "./vendor-permission-expiry-presentation";

describe("resolveVendorPermissionExpiryRisk", () => {
  const now = new Date("2026-10-31T21:30:00.000Z");

  it("warns when the pending 48-hour link expires before scheduled service", () => {
    expect(
      resolveVendorPermissionExpiryRisk({
        permissionRequired: true,
        permissionStatus: "pending",
        expiresAt: "2026-11-02T21:25:00.000Z",
        scheduledFor: "2026-11-03T16:00:00.000Z",
        now,
      }),
    ).toEqual({
      kind: "EXPIRES_BEFORE_SERVICE",
      expiresAt: "2026-11-02T21:25:00.000Z",
      scheduledFor: "2026-11-03T16:00:00.000Z",
    });
  });

  it("makes an expired pending link actionable", () => {
    expect(
      resolveVendorPermissionExpiryRisk({
        permissionRequired: true,
        permissionStatus: "expired",
        expiresAt: "2026-10-31T20:00:00.000Z",
        scheduledFor: "2026-11-03T16:00:00.000Z",
        now,
      })?.kind,
    ).toBe("EXPIRED");
  });

  it("does not warn for a decided request, no-permission scope, or a link valid through service", () => {
    expect(
      resolveVendorPermissionExpiryRisk({
        permissionRequired: true,
        permissionStatus: "accepted",
        expiresAt: "2026-11-02T21:25:00.000Z",
        scheduledFor: "2026-11-03T16:00:00.000Z",
        now,
      }),
    ).toBeNull();
    expect(
      resolveVendorPermissionExpiryRisk({
        permissionRequired: false,
        permissionStatus: "pending",
        expiresAt: "2026-11-02T21:25:00.000Z",
        scheduledFor: "2026-11-03T16:00:00.000Z",
        now,
      }),
    ).toBeNull();
    expect(
      resolveVendorPermissionExpiryRisk({
        permissionRequired: true,
        permissionStatus: "pending",
        expiresAt: "2026-11-04T21:25:00.000Z",
        scheduledFor: "2026-11-03T16:00:00.000Z",
        now,
      }),
    ).toBeNull();
  });
});
