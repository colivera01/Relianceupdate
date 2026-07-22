import { describe, expect, it } from "vitest";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  getAdminApiSessionCookieName,
  getAdminAuthSessionClaimsFromRequest,
  getAdminUiSessionCookieName,
  getAuthSessionClaimsFromRequest,
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
      version: 1,
    });
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
});
