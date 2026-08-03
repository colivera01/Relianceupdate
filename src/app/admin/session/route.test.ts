import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthSessionCookie } from "@/lib/auth-session";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { GET } from "./route";
import { requirePlatformRole } from "@/lib/request-actor";

vi.mock("@/lib/auth-credentials", () => ({
  findDbCredentialByUserId: vi.fn(),
}));

vi.mock("@/lib/auth-login-user", () => ({
  buildAuthLoginUserPayload: vi.fn(),
}));

vi.mock("@/lib/request-actor", () => ({
  requirePlatformRole: vi.fn(),
}));

describe("GET /admin/session", () => {
  beforeEach(() => {
    vi.mocked(requirePlatformRole).mockResolvedValue({
      userId: "admin-user",
      email: "admin@example.com",
      accountStatus: "active",
      platformRoles: ["ADMIN"],
      vendorMemberships: [],
    });
    vi.mocked(findDbCredentialByUserId).mockResolvedValue(null);
    vi.mocked(buildAuthLoginUserPayload).mockResolvedValue({
      id: "admin-user",
      name: "Admin User",
      email: "admin@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
      emailVerified: true,
      emailVerifiedAt: "2026-07-22T00:00:00.000Z",
      avatar: undefined,
    });
  });

  it("hydrates the admin tab and refreshes both scoped cookies", async () => {
    const token = createAuthSessionCookie({
      userId: "admin-user",
      email: "admin@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });
    const response = await GET(
      new Request("http://localhost/admin/session", {
        headers: { cookie: `reliance_admin_session=${token}` },
      })
    );
    const cookies = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      user: { id: "admin-user", userType: "admin" },
    });
    expect(cookies).toContain("reliance_admin_session=");
    expect(cookies).toContain("Path=/admin");
    expect(cookies).toContain("reliance_admin_api_session=");
    expect(cookies).toContain("Path=/api/admin");
  });
});
