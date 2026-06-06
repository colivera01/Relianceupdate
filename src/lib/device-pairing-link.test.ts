import { describe, expect, it } from "vitest";

import {
  createDevicePairingInviteToken,
  verifyDevicePairingInviteToken,
} from "./device-pairing-link";

describe("device-pairing-link", () => {
  it("creates and verifies a signed pairing invite token", () => {
    const token = createDevicePairingInviteToken({
      code: "123456",
      vendorId: "vendor-1",
      vendorName: "Metro Home Care Pros",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const claims = verifyDevicePairingInviteToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.code).toBe("123456");
    expect(claims?.vendorId).toBe("vendor-1");
    expect(claims?.vendorName).toBe("Metro Home Care Pros");
  });

  it("rejects tampered pairing invite tokens", () => {
    const token = createDevicePairingInviteToken({
      code: "654321",
      vendorId: "vendor-2",
      vendorName: "Brooklyn Home Care Studio",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const tampered = `${token}x`;
    expect(verifyDevicePairingInviteToken(tampered)).toBeNull();
  });
});
