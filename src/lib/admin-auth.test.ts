import { beforeEach, describe, expect, it, vi } from "vitest";

const actorMocks = vi.hoisted(() => ({
  resolveRequestActor: vi.fn(),
}));

vi.mock("@/lib/request-actor", () => actorMocks);

describe("readAdminAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorMocks.resolveRequestActor.mockResolvedValue(null);
  });

  it("allows an active actor with a database ADMIN grant", async () => {
    actorMocks.resolveRequestActor.mockResolvedValue({
      userId: "db-admin",
      platformRoles: ["ADMIN"],
      vendorMemberships: [],
    });

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access).toEqual({ userId: "db-admin", role: "admin", isAdmin: true });
    expect(actorMocks.resolveRequestActor).toHaveBeenCalledWith(
      expect.any(Request),
      { adminScope: true }
    );
  });

  it("does not authorize a hardcoded owner identity without a database grant", async () => {
    actorMocks.resolveRequestActor.mockResolvedValue({
      userId: "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0",
      platformRoles: [],
      vendorMemberships: [],
    });

    const { readAdminAccess } = await import("./admin-auth");
    const access = await readAdminAccess(new Request("http://localhost/admin"));

    expect(access.isAdmin).toBe(false);
    expect(access.role).toBeNull();
  });

  it("fails closed when actor resolution fails", async () => {
    actorMocks.resolveRequestActor.mockRejectedValue(new Error("database unavailable"));

    const { readAdminAccess } = await import("./admin-auth");
    await expect(readAdminAccess(new Request("http://localhost/admin"))).resolves.toEqual({
      userId: null,
      role: null,
      isAdmin: false,
    });
  });
});
