import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  vendorMembership: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({ prisma: prismaMocks }));
vi.mock("@/lib/dev-registered-users", () => ({
  registeredUsers: [],
  syncRegisteredUsersFromDisk: vi.fn(),
}));
vi.mock("@/lib/vendor-security", () => ({
  getVendorSessionTimeoutStatus: vi.fn().mockResolvedValue({ expired: false }),
  hasVendorAccessInSession: vi.fn().mockReturnValue(false),
}));

describe("Epic 3 Phase A pre-change identity characterization", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
    prismaMocks.user.findFirst.mockResolvedValue(null);
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "signed-user",
      email: "signed@example.test",
      accountStatus: "active",
      platformRoleGrants: [],
      memberships: [],
    });
    prismaMocks.vendorMembership.findFirst.mockResolvedValue(null);
  });

  it("accepts the signed session as the candidate user identity", async () => {
    const { createAuthSessionCookie } = await import("./auth-session");
    const { getUserIdFromRequest } = await import("./auth");
    const token = createAuthSessionCookie({
      userId: "signed-user",
      email: "signed@example.test",
      userType: "customer",
      availableProfiles: ["customer"],
    });

    const request = new Request("http://localhost/api/auth/session", {
      headers: { cookie: `reliance_session=${token}` },
    });

    expect(await getUserIdFromRequest(request)).toBe("signed-user");
  });

  it("rejects an unsigned compatibility userId cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getUserIdFromRequest } = await import("./auth");
    const request = new Request("http://localhost/api/customer/profile", {
      headers: { cookie: "userId=unsigned-compatibility-user" },
    });

    expect(await getUserIdFromRequest(request)).toBeNull();
  });

  it("rejects an unsigned compatibility x-user-id header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getUserIdFromRequest } = await import("./auth");
    const request = new Request("http://localhost/api/customer/profile", {
      headers: { "x-user-id": "unsigned-compatibility-user" },
    });

    expect(await getUserIdFromRequest(request)).toBeNull();
  });

  it("rejects an unsigned compatibility vendorId cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getVendorIdFromRequest } = await import("./auth");
    const request = new Request("http://localhost/api/vendor/context", {
      headers: { cookie: "vendorId=unsigned-compatibility-vendor" },
    });

    expect(await getVendorIdFromRequest(request)).toBeNull();
  });
});
