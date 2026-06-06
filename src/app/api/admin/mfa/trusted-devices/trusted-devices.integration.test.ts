import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();
  const authTrustedDeviceFindMany = vi.fn();
  const authTrustedDeviceFindUnique = vi.fn();
  const authTrustedDeviceUpdate = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const prisma = {
    vendorMembership: {
      findMany: vendorMembershipFindMany,
      findFirst: vendorMembershipFindFirst,
    },
    authTrustedDevice: {
      findMany: authTrustedDeviceFindMany,
      findUnique: authTrustedDeviceFindUnique,
      update: authTrustedDeviceUpdate,
    },
  };
  return {
    prisma,
    vendorMembershipFindMany,
    authTrustedDeviceFindMany,
    authTrustedDeviceFindUnique,
    authTrustedDeviceUpdate,
    vendorMembershipFindFirst,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("admin trusted devices route", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.authTrustedDeviceFindMany.mockReset();
    hoisted.authTrustedDeviceFindUnique.mockReset();
    hoisted.authTrustedDeviceUpdate.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
  });

  it("GET returns 503 when the database is temporarily unavailable", async () => {
    hoisted.vendorMembershipFindMany.mockRejectedValue(new Error("Can't reach database server at demo"));

    const res = await GET(
      new Request("http://localhost/api/admin/mfa/trusted-devices?targetType=vendor&targetId=vendor-1")
    );

    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe(PUBLIC_DB_UNAVAILABLE_CODE);
    expect(String(json.error || "")).toContain("temporarily unavailable");
  });

  it("POST returns 503 when revocation cannot reach the database", async () => {
    hoisted.authTrustedDeviceFindUnique.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      label: "Remembered device",
      expiresAt: new Date("2026-06-30T00:00:00.000Z"),
      revokedAt: null,
      credential: {
        email: "member@example.com",
        user: { name: "Vendor Member" },
      },
    });
    hoisted.vendorMembershipFindFirst.mockResolvedValue({ id: "membership-1" });
    hoisted.authTrustedDeviceUpdate.mockRejectedValue(new Error("Can't reach database server at demo"));

    const res = await POST(
      new Request("http://localhost/api/admin/mfa/trusted-devices", {
        method: "POST",
        body: JSON.stringify({
          targetType: "vendor",
          targetId: "vendor-1",
          deviceId: "device-1",
        }),
      })
    );

    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe(PUBLIC_DB_UNAVAILABLE_CODE);
    expect(String(json.error || "")).toContain("temporarily unavailable");
  });
});
