import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  vendorMembership: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({ prisma: prismaMocks }));

describe("Epic 3 Phase A pre-change exact vendor characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.test",
      phone: null,
      accountStatus: "active",
    });
  });

  it("does not fall back to another vendor when exact preferred membership is missing", async () => {
    prismaMocks.vendorMembership.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "membership-2",
          vendorId: "vendor-2",
          status: "ACTIVE",
          role: "MANAGER",
          requestedAt: new Date("2026-01-01T00:00:00.000Z"),
          approvedAt: new Date("2026-01-02T00:00:00.000Z"),
          vendor: {
            id: "vendor-2",
            businessName: "Other Vendor",
            name: "Other Vendor",
            accountStatus: "active",
          },
        },
      ]);

    const { resolveVendorAccessForUser } = await import("./vendor-context");
    const access = await resolveVendorAccessForUser("user-1", {
      preferredVendorId: "vendor-1",
    });

    expect(access.state).toBe("NONE");
    expect(access.vendorId).toBeNull();
    expect(prismaMocks.vendorMembership.findMany).toHaveBeenCalledTimes(1);
  });
});
