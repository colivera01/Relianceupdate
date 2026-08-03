import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    vendorMembership: {
      findMany: vi.fn(),
    },
  },
}));

describe("resolveVendorAccessForUser", () => {
  beforeEach(() => {
    vi.mocked((prisma as any).user.findUnique).mockReset();
    vi.mocked((prisma as any).vendorMembership.findMany).mockReset();
    vi.mocked((prisma as any).user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "user-1@example.test",
      phone: null,
      accountStatus: "active",
    });
  });

  it("returns no vendor authority when the database has no membership", async () => {
    vi.mocked((prisma as any).vendorMembership.findMany).mockResolvedValue([]);

    const access = await resolveVendorAccessForUser("user-1");

    expect(access).toMatchObject({
      state: "NONE",
      userId: "user-1",
      vendorId: null,
      membershipId: null,
    });
  });

  it("derives vendor authority from the current database membership", async () => {
    vi.mocked((prisma as any).vendorMembership.findMany).mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        status: "ACTIVE",
        role: "MANAGER",
        requestedAt: new Date("2026-08-02T00:00:00.000Z"),
        approvedAt: new Date("2026-08-02T00:01:00.000Z"),
        vendor: {
          id: "vendor-1",
          name: "Synthetic Vendor",
          accountStatus: "active",
          status: "approved",
          onboardingStatus: "approved",
          published: true,
        },
      },
    ]);

    const access = await resolveVendorAccessForUser("user-1");

    expect(access).toMatchObject({
      state: "ACTIVE",
      userId: "user-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      role: "MANAGER",
    });
  });

  it("does not fall back to another membership for an unauthorized preferred vendor", async () => {
    vi.mocked((prisma as any).vendorMembership.findMany).mockResolvedValue([]);

    const access = await resolveVendorAccessForUser("user-1", {
      preferredVendorId: "vendor-not-owned",
    });

    expect(access.state).toBe("NONE");
    expect((prisma as any).vendorMembership.findMany).toHaveBeenCalledTimes(1);
  });
});
