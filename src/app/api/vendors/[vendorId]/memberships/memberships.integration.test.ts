import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();
  const prisma = {
    vendorMembership: {
      findMany: vendorMembershipFindMany,
    },
    employeePublicMediaConsentDecision: {
      findMany: vi.fn(),
    },
  };
  return { prisma, vendorMembershipFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
  requireVendorMembership: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/vendors/[vendorId]/memberships", () => {
  beforeEach(() => {
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({} as any);
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({ role: "MANAGER" } as any);
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.prisma.employeePublicMediaConsentDecision.findMany.mockReset();
    hoisted.prisma.employeePublicMediaConsentDecision.findMany.mockResolvedValue([]);
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
        where: {
          vendorId: "v1",
          status: { in: ["PENDING", "pending", "PENDING"] },
        },
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
      publicMediaConsent: { status: "NOT_DECIDED", decidedAt: null },
    });
  });

  it("includes read-only participation state on the active Manager roster", async () => {
    hoisted.vendorMembershipFindMany.mockResolvedValue([{
      id: "vm1",
      userId: "u1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { id: "u1", name: "Taylor", email: "taylor@example.com", phone: null },
    }]);
    hoisted.prisma.employeePublicMediaConsentDecision.findMany.mockResolvedValue([{
      membershipId: "vm1",
      decision: "ALLOW",
      decidedAt: new Date("2026-09-09T20:00:00.000Z"),
    }]);

    const res = await GET(new Request("http://localhost/api/vendors/v1/memberships?status=ACTIVE"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect((json.memberships as any[])[0].publicMediaConsent).toMatchObject({ status: "ALLOWED" });
  });

  it("does not expose another Employee's participation state to an Employee roster reader", async () => {
    vi.mocked(requireVendorMembership).mockResolvedValue({ role: "EMPLOYEE" } as any);
    hoisted.vendorMembershipFindMany.mockResolvedValue([{
      id: "vm1",
      userId: "u1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { id: "u1", name: "Taylor", email: "taylor@example.com", phone: null },
    }]);

    const res = await GET(new Request("http://localhost/api/vendors/v1/memberships?status=ACTIVE"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect((json.memberships as any[])[0]).not.toHaveProperty("publicMediaConsent");
    expect(hoisted.prisma.employeePublicMediaConsentDecision.findMany).not.toHaveBeenCalled();
  });
});
