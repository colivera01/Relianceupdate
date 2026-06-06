import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";

const hoisted = vi.hoisted(() => {
  const userFindFirst = vi.fn();
  return {
    prisma: {
      user: { findFirst: userFindFirst },
    },
    userFindFirst,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("POST /api/auth/login account status", () => {
  beforeEach(() => {
    hoisted.userFindFirst.mockReset();
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "NONE",
      userId: "user-1",
      vendorId: null,
      membershipId: null,
      membershipStatus: null,
      accountStatus: null,
      restrictedAccountType: null,
      role: null,
      businessName: null,
    });
  });

  it("blocks a suspended user from signing in", async () => {
    hoisted.userFindFirst.mockResolvedValue({
      id: "user-1",
      accountStatus: "suspended",
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "e2e-smoke-customer@reliance.test",
          password: "E2E_Smoke_dev_only_9!",
        }),
      }) as any
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      code: "USER_ACCOUNT_RESTRICTED",
      accountStatus: "suspended",
    });
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });
});
