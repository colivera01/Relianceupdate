import { describe, expect, it } from "vitest";
import {
  calculateVendorSessionExpiryMs,
  hasVendorAccessInSession,
  isVendorSessionExpired,
  normalizeVendorSessionTimeoutMinutes,
} from "@/lib/vendor-security";

describe("vendor-security", () => {
  it("recognizes vendor-capable sessions", () => {
    expect(hasVendorAccessInSession({ userType: "vendor", availableProfiles: [] })).toBe(true);
    expect(hasVendorAccessInSession({ userType: "both", availableProfiles: ["customer"] })).toBe(true);
    expect(hasVendorAccessInSession({ userType: "customer", availableProfiles: ["vendor"] })).toBe(true);
    expect(hasVendorAccessInSession({ userType: "customer", availableProfiles: ["customer"] })).toBe(false);
  });

  it("clamps vendor session timeout to a safe range", () => {
    expect(normalizeVendorSessionTimeoutMinutes(0)).toBe(5);
    expect(normalizeVendorSessionTimeoutMinutes(2)).toBe(5);
    expect(normalizeVendorSessionTimeoutMinutes(30)).toBe(30);
    expect(normalizeVendorSessionTimeoutMinutes(9999)).toBe(1440);
    expect(normalizeVendorSessionTimeoutMinutes("not-a-number")).toBe(30);
  });

  it("calculates an idle deadline from the supplied activity time", () => {
    expect(calculateVendorSessionExpiryMs(1000, 30)).toBe(1000 * 1000 + 30 * 60 * 1000);
    expect(calculateVendorSessionExpiryMs(null, 30)).toBeNull();
  });

  it("marks vendor sessions expired after the configured timeout", () => {
    const claims = { issuedAt: 1000 };
    expect(isVendorSessionExpired(claims, 30, 1000 * 1000 + 29 * 60 * 1000)).toBe(false);
    expect(isVendorSessionExpired(claims, 30, 1000 * 1000 + 30 * 60 * 1000)).toBe(true);
  });

  it("uses last authenticated activity instead of original sign-in for idle expiry", () => {
    const claims = { issuedAt: 1000, lastActivityAt: 1600 };
    expect(isVendorSessionExpired(claims, 30, 1600 * 1000 + 29 * 60 * 1000)).toBe(false);
    expect(isVendorSessionExpired(claims, 30, 1600 * 1000 + 30 * 60 * 1000)).toBe(true);
  });
});
