import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthBearerToken, createAuthSessionCookie } from "./auth-session";

const prismaMocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  platformRoleGrant: { findMany: vi.fn() },
  vendorMembership: { findMany: vi.fn() },
}));

vi.mock("@/server/db", () => ({ prisma: prismaMocks }));

function signedRequest(userId: string, path = "/api/customer/profile") {
  const token = createAuthSessionCookie({
    userId,
    email: `${userId}@example.test`,
    userType: "admin",
    availableProfiles: ["admin", "vendor"],
  });
  const cookieName = path.startsWith("/api/admin") ? "reliance_admin_api_session" : "reliance_session";
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `${cookieName}=${token}` },
  });
}

describe("canonical request actor", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("rebuilds roles and memberships from current database state", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.test",
      accountStatus: "active",
      platformRoleGrants: [{ role: "ADMIN" }],
      memberships: [{ id: "m-1", vendorId: "v-1", role: "MANAGER" }],
    });

    const { resolveRequestActor } = await import("./request-actor");
    const actor = await resolveRequestActor(signedRequest("user-1"));

    expect(actor).toMatchObject({
      userId: "user-1",
      platformRoles: ["ADMIN"],
      vendorMemberships: [{ id: "m-1", vendorId: "v-1", role: "MANAGER" }],
    });
  });

  it("ignores admin and vendor claims when the database grants neither", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "user-2@example.test",
      accountStatus: "active",
      platformRoleGrants: [],
      memberships: [],
    });

    const { resolveRequestActor } = await import("./request-actor");
    const actor = await resolveRequestActor(signedRequest("user-2"));

    expect(actor?.platformRoles).toEqual([]);
    expect(actor?.vendorMemberships).toEqual([]);
  });

  it("rejects a restricted current database user", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-3",
      email: "user-3@example.test",
      accountStatus: "suspended",
      platformRoleGrants: [{ role: "ADMIN" }],
      memberships: [],
    });

    const { resolveRequestActor } = await import("./request-actor");
    await expect(resolveRequestActor(signedRequest("user-3"))).rejects.toMatchObject({
      code: "ACCOUNT_RESTRICTED",
      statusCode: 403,
    });
  });

  it("requires an admin-scoped session in addition to a database grant", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-4",
      email: "user-4@example.test",
      accountStatus: "active",
      platformRoleGrants: [{ role: "ADMIN" }],
      memberships: [],
    });
    const generalOnly = signedRequest("user-4", "/api/customer/profile");

    const { requirePlatformRole } = await import("./request-actor");
    await expect(requirePlatformRole(generalOnly, "ADMIN")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  });

  it("does not accept a general signed bearer token as an admin-scoped session", async () => {
    const bearer = createAuthBearerToken({
      userId: "user-5",
      email: "user-5@example.test",
      userType: "admin",
      availableProfiles: ["admin"],
    });
    const request = new Request("http://localhost/api/admin/stats", {
      headers: { authorization: `Bearer ${bearer}` },
    });

    const { requirePlatformRole } = await import("./request-actor");
    await expect(requirePlatformRole(request, "ADMIN")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
    expect(prismaMocks.user.findUnique).not.toHaveBeenCalled();
  });

  it("queries only current active memberships for active vendors", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-6",
      email: "user-6@example.test",
      accountStatus: "active",
      platformRoleGrants: [],
      memberships: [],
    });

    const { resolveRequestActor } = await import("./request-actor");
    await resolveRequestActor(signedRequest("user-6"));

    expect(prismaMocks.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          memberships: expect.objectContaining({
            where: {
              status: "ACTIVE",
              vendor: { accountStatus: "active" },
            },
          }),
        }),
      })
    );
  });

  it("denies access to a different vendor", async () => {
    const actor = {
      userId: "user-7",
      email: "user-7@example.test",
      accountStatus: "active" as const,
      platformRoles: [],
      vendorMemberships: [{ id: "m-7", vendorId: "vendor-a", role: "MANAGER" as const }],
    };

    const { requireActorVendorMembership } = await import("./request-actor");
    expect(() => requireActorVendorMembership(actor, "vendor-b")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 })
    );
  });

  it("does not let an employee exercise manager authority", async () => {
    const actor = {
      userId: "user-8",
      email: "user-8@example.test",
      accountStatus: "active" as const,
      platformRoles: [],
      vendorMemberships: [{ id: "m-8", vendorId: "vendor-a", role: "EMPLOYEE" as const }],
    };

    const { requireActorVendorManager } = await import("./request-actor");
    expect(() => requireActorVendorManager(actor, "vendor-a")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 })
    );
  });

  it("rejects an idle-expired vendor session after rebuilding database authority", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    const token = createAuthSessionCookie({
      userId: "user-9",
      email: "user-9@example.test",
      userType: "vendor",
      availableProfiles: ["vendor"],
    });
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-9",
      email: "user-9@example.test",
      accountStatus: "active",
      platformRoleGrants: [],
      memberships: [{ id: "m-9", vendorId: "vendor-a", role: "MANAGER" }],
    });
    prismaMocks.vendorMembership.findMany.mockResolvedValue([
      {
        vendorId: "vendor-a",
        vendor: {
          id: "vendor-a",
          businessName: "Vendor A",
          name: "Vendor A",
          loginNotifications: true,
          sessionTimeout: 30,
        },
      },
    ]);
    vi.setSystemTime(new Date("2026-08-17T12:31:00.000Z"));
    const request = new Request("http://localhost/api/vendors/vendor-a/jobs", {
      headers: { cookie: `reliance_session=${token}` },
    });

    const { resolveRequestActor } = await import("./request-actor");
    await expect(resolveRequestActor(request)).rejects.toMatchObject({
      code: "VENDOR_SESSION_TIMEOUT",
      statusCode: 401,
    });
    expect(prismaMocks.user.findUnique).toHaveBeenCalled();
  });
});
