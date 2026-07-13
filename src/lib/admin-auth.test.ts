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

  it("allows the owner admin email even when cached profiles are stale", async () => {
    authSessionMocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "current-owner-row",
      email: "colivera080124@gmail.com",
      userType: "customer",
      availableProfiles: ["customer"],
      issuedAt: 1,
      expiresAt: 9999999999,
      version: 1,
    });
    authMocks.getUserIdFromRequest.mockResolvedValue("current-owner-row");

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access.isAdmin).toBe(true);
    expect(access.role).toBe("customer");
    expect(prismaMocks.user.findUnique).not.toHaveBeenCalled();
  });

  it("allows the owner admin phone as a database fallback for stale sessions", async () => {
    authSessionMocks.getAuthSessionClaimsFromRequest.mockReturnValue({
      userId: "current-owner-row",
      email: "bradley@example.com",
      userType: "customer",
      availableProfiles: ["customer"],
      issuedAt: 1,
      expiresAt: 9999999999,
      version: 1,
    });
    authMocks.getUserIdFromRequest.mockResolvedValue("current-owner-row");
    prismaMocks.user.findUnique.mockResolvedValue({
      email: "bradley@example.com",
      phone: "4079148888",
    });

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access.isAdmin).toBe(true);
    expect(prismaMocks.user.findUnique).toHaveBeenCalledWith({
      where: { id: "current-owner-row" },
      select: {
        email: true,
        phone: true,
      },
    });
  });
});
