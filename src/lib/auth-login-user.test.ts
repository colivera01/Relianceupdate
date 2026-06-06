import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("buildAuthLoginUserPayload", () => {
  beforeEach(() => {
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked((prisma as any).user.findUnique).mockReset();
    vi.mocked((prisma as any).user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Brand Newvendor",
      email: "brandnew.vendor@reliance.test",
      phone: "4075557788",
    });
  });

  it("treats pending vendor memberships as vendor-capable during MFA session hydration", async () => {
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

    expect(payload.userType).toBe("vendor");
    expect(payload.availableProfiles).toEqual(["vendor"]);
  });
});
