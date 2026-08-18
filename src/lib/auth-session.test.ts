import { describe, expect, it, vi } from "vitest";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  getAdminApiSessionCookieName,
  getAdminAuthSessionClaimsFromRequest,
  getAdminUiSessionCookieName,
  getAuthSessionClaimsFromRequest,
  refreshAuthSessionCookie,
  verifyAuthBearerToken,
  verifyAuthSessionCookie,
} from "./auth-session";

describe("auth-session", () => {
  it("creates and verifies a signed session cookie", () => {
    const token = createAuthSessionCookie({
      userId: "user-1",
      email: "user@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
    });

    const claims = verifyAuthSessionCookie(token);
    expect(claims).toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
      version: 2,
    });
    expect(claims?.lastActivityAt).toBe(claims?.issuedAt);
  });

  it("rejects tampered session cookies", () => {
    const token = createAuthSessionCookie({
      userId: "user-1",
      email: "user@example.com",
      userType: "customer",
      availableProfiles: ["customer"],
    });

    const tampered = `${token.slice(0, -1)}x`;
    expect(verifyAuthSessionCookie(tampered)).toBeNull();
  });

  it("refreshes activity without extending the absolute session lifetime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    const original = createAuthSessionCookie({
      userId: "vendor-1",
      email: "vendor@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
    });
    const before = verifyAuthSessionCookie(original)!;

    vi.setSystemTime(new Date("2026-08-17T12:10:00.000Z"));
    const refreshed = refreshAuthSessionCookie(original);
    const after = verifyAuthSessionCookie(refreshed)!;

    expect(after.issuedAt).toBe(before.issuedAt);
    expect(after.expiresAt).toBe(before.expiresAt);
    expect(after.lastActivityAt).toBe(Math.floor(Date.now() / 1000));
    expect(after.version).toBe(2);
    vi.useRealTimers();
  });

  it("cannot refresh a session after its absolute lifetime expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    const token = createAuthSessionCookie({
      userId: "vendor-absolute",
      email: "vendor@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
    });
    vi.setSystemTime(new Date("2026-08-24T12:00:01.000Z"));
    expect(verifyAuthSessionCookie(token)).toBeNull();
    expect(refreshAuthSessionCookie(token)).toBeNull();
    vi.useRealTimers();
  });

  it("creates and verifies a signed bearer token", () => {
    const token = createAuthBearerToken({
      userId: "user-2",
      email: "bearer@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });

    const claims = verifyAuthBearerToken(token);
    expect(claims).toMatchObject({
      userId: "user-2",
      email: "bearer@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });
  });

  it("keeps admin and general sessions distinct when both cookies are present", () => {
    const vendorToken = createAuthSessionCookie({
      userId: "vendor-user",
      email: "vendor@example.com",
      userType: "vendor",
      availableProfiles: ["customer", "vendor"],
    });
    const adminToken = createAuthSessionCookie({
      userId: "admin-user",
      email: "admin@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });
    const cookie = [
      `reliance_session=${vendorToken}`,
      `${getAdminUiSessionCookieName()}=${adminToken}`,
      `${getAdminApiSessionCookieName()}=${adminToken}`,
    ].join("; ");

    const generalClaims = getAuthSessionClaimsFromRequest(
      new Request("http://localhost/api/auth/session", { headers: { cookie } })
    );
    const adminPageClaims = getAdminAuthSessionClaimsFromRequest(
      new Request("http://localhost/admin/dashboard", { headers: { cookie } })
    );
    const adminApiClaims = getAdminAuthSessionClaimsFromRequest(
      new Request("http://localhost/api/admin/reports/summary", { headers: { cookie } })
    );

    expect(generalClaims?.userId).toBe("vendor-user");
    expect(adminPageClaims?.userId).toBe("admin-user");
    expect(adminApiClaims?.userId).toBe("admin-user");
  });

  it("does not treat the general session cookie as an admin-scoped session", () => {
    const generalToken = createAuthSessionCookie({
      userId: "claimed-admin",
      email: "claimed@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });
    const request = new Request("http://localhost/admin/dashboard", {
      headers: { cookie: `reliance_session=${generalToken}` },
    });

    expect(getAdminAuthSessionClaimsFromRequest(request)).toBeNull();
  });
});
