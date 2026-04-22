import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();
  const prisma = {
    vendorMembership: {
      findMany: vendorMembershipFindMany,
    },
  };
  return { prisma, vendorMembershipFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/vendors/[vendorId]/memberships", () => {
  beforeEach(() => {
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({} as any);
    hoisted.vendorMembershipFindMany.mockReset();
  });

  it("returns 403 when requester is not vendor manager", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/vendors/v1/memberships", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(403);
    expect(hoisted.vendorMembershipFindMany).not.toHaveBeenCalled();
  });

  it("returns empty memberships list", async () => {
    hoisted.vendorMembershipFindMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/vendors/v1/memberships?status=PENDING", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.memberships).toEqual([]);
    expect(hoisted.vendorMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendorId: "v1", status: "PENDING" },
      })
    );
  });

  it("returns normalized manager-scoped membership rows", async () => {
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "vm1",
        userId: "u1",
        role: "EMPLOYEE",
        status: "ACTIVE",
        badgeId: "badge-1",
        requestedAt: new Date("2026-04-10T10:00:00.000Z"),
        approvedAt: new Date("2026-04-11T10:00:00.000Z"),
        deniedAt: null,
        revokedAt: null,
        pendingPhoneDeviceUid: "dev-1",
        pendingDeviceModel: "Pixel",
        pendingDeviceOs: "Android",
        pendingAppVersion: "1.0.0",
        user: {
          id: "u1",
          name: "Taylor",
          email: "taylor@example.com",
          phone: "555-1234",
        },
      },
    ]);
    const req = new Request("http://localhost/api/vendors/v1/memberships", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    const rows = j.memberships as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "vm1",
      userId: "u1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      pendingDeviceModel: "Pixel",
    });
  });
});
