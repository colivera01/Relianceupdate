import { describe, expect, it, vi, beforeEach } from "vitest";

const authSessionMocks = vi.hoisted(() => ({
  getAuthSessionClaimsFromRequest: vi.fn(),
  verifyAuthBearerToken: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  verifyJwt: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("./auth-session", () => authSessionMocks);
vi.mock("./auth", () => authMocks);
vi.mock("@/server/db", () => ({
  prisma: prismaMocks,
}));

describe("readAdminAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSessionMocks.verifyAuthBearerToken.mockReturnValue(null);
    authMocks.getUserIdFromRequest.mockResolvedValue(null);
    prismaMocks.user.findUnique.mockResolvedValue(null);
  });

  it("allows the registered owner admin user id even when cached profiles are stale", async () => {
    authSessionMocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0",
      email: "colivera080124@gmail.com",
      userType: "customer",
      availableProfiles: ["customer"],
      issuedAt: 1,
      expiresAt: 9999999999,
      version: 1,
    });
    authMocks.getUserIdFromRequest.mockResolvedValue("D43B6BB3-1A72-45EC-A362-A6E1E0580EA0");

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access.isAdmin).toBe(true);
    expect(access.role).toBe("customer");
    expect(prismaMocks.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not promote a different account that shares the owner email", async () => {
    authSessionMocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "electro-vendor-row",
      email: "colivera080124@gmail.com",
      userType: "customer",
      availableProfiles: ["customer"],
      issuedAt: 1,
      expiresAt: 9999999999,
      version: 1,
    });
    authMocks.getUserIdFromRequest.mockResolvedValue("electro-vendor-row");

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access.isAdmin).toBe(false);
    expect(prismaMocks.user.findUnique).not.toHaveBeenCalled();
  });
});
