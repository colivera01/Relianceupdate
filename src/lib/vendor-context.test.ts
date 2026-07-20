import { beforeEach, describe, expect, it, vi } from "vitest";
import { OWNER_ADMIN_USER_ID } from "@/lib/internal-identities";
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
  });

  it("does not expose a legacy Vendor membership to the designated Admin identity", async () => {
    const access = await resolveVendorAccessForUser(OWNER_ADMIN_USER_ID);

    expect(access).toMatchObject({
      state: "NONE",
      userId: OWNER_ADMIN_USER_ID,
      vendorId: null,
      membershipId: null,
    });
    expect((prisma as any).user.findUnique).not.toHaveBeenCalled();
    expect((prisma as any).vendorMembership.findMany).not.toHaveBeenCalled();
  });
});
