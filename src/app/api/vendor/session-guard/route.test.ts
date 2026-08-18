import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRequestActor: vi.fn(),
  authorizationErrorResponse: vi.fn(),
  getAuthSessionClaimsFromRequest: vi.fn(),
  getAuthSessionTokenFromRequest: vi.fn(),
  refreshAuthSessionCookie: vi.fn(),
  verifyAuthSessionCookie: vi.fn(),
  getVendorSessionTimeoutStatus: vi.fn(),
}));

vi.mock("@/lib/request-actor", () => ({
  requireRequestActor: mocks.requireRequestActor,
  authorizationErrorResponse: mocks.authorizationErrorResponse,
}));

vi.mock("@/lib/auth-session", () => ({
  getAuthSessionClaimsFromRequest: mocks.getAuthSessionClaimsFromRequest,
  getAuthSessionTokenFromRequest: mocks.getAuthSessionTokenFromRequest,
  refreshAuthSessionCookie: mocks.refreshAuthSessionCookie,
  verifyAuthSessionCookie: mocks.verifyAuthSessionCookie,
  getAuthSessionCookieName: () => "reliance_session",
  getAuthSessionCookieOptions: () => ({ path: "/", sameSite: "lax", httpOnly: true, secure: false, maxAge: 604800 }),
}));

vi.mock("@/lib/vendor-security", () => ({
  getVendorSessionTimeoutStatus: mocks.getVendorSessionTimeoutStatus,
}));

import { GET, POST } from "./route";

describe("vendor session guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRequestActor.mockResolvedValue({ vendorMemberships: [{ id: "m-1", vendorId: "v-1", role: "MANAGER" }] });
    mocks.getVendorSessionTimeoutStatus.mockResolvedValue({
      applies: true,
      expired: false,
      timeoutMinutes: 30,
      expiresAtMs: Date.now() + 30 * 60_000,
      idleExpiresAtMs: Date.now() + 30 * 60_000,
      absoluteExpiresAtMs: Date.now() + 7 * 24 * 60 * 60_000,
      warningAtMs: Date.now() + 25 * 60_000,
    });
  });

  it("reports idle and absolute deadlines without renewing during a status check", async () => {
    mocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "u-1",
      userType: "vendor",
      availableProfiles: ["vendor"],
      issuedAt: 1,
      expiresAt: 9999999999,
      lastActivityAt: 2,
      version: 2,
    });

    const response = await GET(new Request("http://localhost/api/vendor/session-guard") as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, applies: true, timeoutMinutes: 30 });
    expect(body.idleExpiresAt).toBeTruthy();
    expect(body.absoluteExpiresAt).toBeTruthy();
    expect(mocks.refreshAuthSessionCookie).not.toHaveBeenCalled();
  });

  it("renews the idle marker while preserving the signed absolute expiry", async () => {
    mocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "u-1",
      userType: "vendor",
      availableProfiles: ["vendor"],
      issuedAt: 100,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      lastActivityAt: Math.floor(Date.now() / 1000),
      version: 2,
    });
    mocks.getAuthSessionTokenFromRequest.mockReturnValue("old-signed-token");
    mocks.refreshAuthSessionCookie.mockReturnValue("new-signed-token");
    mocks.verifyAuthSessionCookie.mockReturnValue({
      userId: "u-1",
      userType: "vendor",
      availableProfiles: ["vendor"],
      issuedAt: 100,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      lastActivityAt: Math.floor(Date.now() / 1000),
      version: 2,
    });

    const response = await POST(new Request("http://localhost/api/vendor/session-guard", { method: "POST" }) as any);
    expect(response.status).toBe(200);
    expect(mocks.requireRequestActor).toHaveBeenCalledWith(expect.anything(), { allowExpiredVendorSession: true });
    expect(mocks.refreshAuthSessionCookie).toHaveBeenCalledWith("old-signed-token");
    expect(response.headers.get("set-cookie")).toContain("reliance_session=new-signed-token");
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("new-signed-token");
  });

  it("does not revive a session after its idle deadline", async () => {
    mocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "u-1",
      userType: "vendor",
      availableProfiles: ["vendor"],
      issuedAt: 100,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      lastActivityAt: 200,
      version: 2,
    });
    mocks.getVendorSessionTimeoutStatus.mockResolvedValue({
      applies: true,
      expired: true,
      timeoutMinutes: 30,
      expiresAtMs: Date.now() - 1,
      idleExpiresAtMs: Date.now() - 1,
      absoluteExpiresAtMs: Date.now() + 3600_000,
      warningAtMs: Date.now() - 300_000,
    });

    const response = await POST(new Request("http://localhost/api/vendor/session-guard", { method: "POST" }) as any);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "VENDOR_SESSION_TIMEOUT" });
    expect(mocks.refreshAuthSessionCookie).not.toHaveBeenCalled();
  });
});
