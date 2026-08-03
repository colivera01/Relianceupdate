import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";
import { OWNER_ADMIN_BETA_USER_ID, OWNER_ADMIN_USER_ID } from "@/lib/internal-identities";

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    platformRoleGrant: {
      findMany: vi.fn(),
    },
  },
}));

describe("buildAuthLoginUserPayload", () => {
  beforeEach(() => {
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked((prisma as any).user.findUnique).mockReset();
    vi.mocked((prisma as any).platformRoleGrant.findMany).mockReset();
    vi.mocked((prisma as any).platformRoleGrant.findMany).mockResolvedValue([]);
    vi.mocked((prisma as any).user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Brand Newvendor",
      email: "brandnew.vendor@reliance.test",
      phone: "4075557788",
    });
  });

  it("keeps customer access while treating pending vendor onboarding as vendor-capable", async () => {
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "PENDING",
      userId: "user-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipStatus: "PENDING",
      accountStatus: "active",
      restrictedAccountType: null,
      role: "MANAGER",
      businessName: "Brand New Vendor Plumbing",
    } as any);

    const payload = await buildAuthLoginUserPayload({
      userId: "user-1",
      email: "brandnew.vendor@reliance.test",
      emailVerifiedAt: new Date("2026-06-05T12:00:00.000Z"),
    });

    expect(payload.userType).toBe("both");
    expect(payload.availableProfiles).toEqual(["customer", "vendor"]);
  });

  it("does not promote a formerly hardcoded owner identity without a database grant", async () => {
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({ state: "NONE" } as any);
    vi.mocked((prisma as any).user.findUnique).mockResolvedValue({
      id: OWNER_ADMIN_USER_ID,
      name: "Reliance Admin",
      email: "admin@reliance.test",
      phone: "4075550000",
    });

    const payload = await buildAuthLoginUserPayload({
      userId: OWNER_ADMIN_USER_ID,
      email: "admin@reliance.test",
      emailVerifiedAt: new Date("2026-06-05T12:00:00.000Z"),
    });
    expect(payload.userType).toBe("customer");
    expect(payload.availableProfiles).toEqual(["customer"]);
    expect(resolveVendorAccessForUser).toHaveBeenCalledWith(OWNER_ADMIN_USER_ID);
  });

  it("keeps the beta Admin database identity Admin-only", async () => {
    vi.mocked((prisma as any).platformRoleGrant.findMany).mockResolvedValue([{ role: "ADMIN" }]);
    vi.mocked((prisma as any).user.findUnique).mockResolvedValue({
      id: OWNER_ADMIN_BETA_USER_ID,
      name: "Reliance Admin",
      email: "admin@reliance.test",
      phone: "4075550000",
    });

    const payload = await buildAuthLoginUserPayload({
      userId: OWNER_ADMIN_BETA_USER_ID,
      email: "admin@reliance.test",
      emailVerifiedAt: new Date("2026-06-05T12:00:00.000Z"),
    });

    expect(payload.userType).toBe("admin");
    expect(payload.availableProfiles).toEqual(["admin"]);
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });
});
