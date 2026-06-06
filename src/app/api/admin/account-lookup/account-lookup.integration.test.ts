import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";

const hoisted = vi.hoisted(() => {
  const userFindMany = vi.fn();
  const vendorFindMany = vi.fn();
  const prisma = {
    user: { findMany: userFindMany },
    vendor: { findMany: vendorFindMany },
  };
  return { prisma, userFindMany, vendorFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("GET /api/admin/account-lookup", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    hoisted.userFindMany.mockReset();
    hoisted.vendorFindMany.mockReset();
  });

  it("searches users and vendors for admins", async () => {
    hoisted.userFindMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Alex Customer",
        email: "alex@example.com",
        phone: null,
        accountStatus: "active",
        accountStatusUpdatedAt: null,
        accountStatusReason: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);
    hoisted.vendorFindMany.mockResolvedValue([
      {
        id: "vendor-1",
        name: "Vendor Owner",
        businessName: "Safe Cleaners",
        email: "vendor@example.com",
        phone: "555-0100",
        accountStatus: "suspended",
        accountStatusUpdatedAt: new Date("2026-05-25T12:00:00.000Z"),
        accountStatusReason: "policy_violation",
        isPubliclyListed: false,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const res = await GET(new Request("http://localhost/api/admin/account-lookup?q=alex"));

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.results).toEqual([
      expect.objectContaining({
        targetType: "user",
        id: "user-1",
        displayName: "Alex Customer",
      }),
      expect.objectContaining({
        targetType: "vendor",
        id: "vendor-1",
        displayName: "Safe Cleaners",
        accountStatus: "suspended",
      }),
    ]);
    expect(hoisted.userFindMany).toHaveBeenCalled();
    expect(hoisted.vendorFindMany).toHaveBeenCalled();
  });

  it("requires at least two search characters", async () => {
    const res = await GET(new Request("http://localhost/api/admin/account-lookup?q=a"));

    expect(res.status).toBe(400);
    expect(hoisted.userFindMany).not.toHaveBeenCalled();
    expect(hoisted.vendorFindMany).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests before searching", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));

    const res = await GET(new Request("http://localhost/api/admin/account-lookup?q=alex"));

    expect(res.status).toBe(403);
    expect(hoisted.userFindMany).not.toHaveBeenCalled();
    expect(hoisted.vendorFindMany).not.toHaveBeenCalled();
  });

  it("supports vendor browse mode with activity filtering and alphabetical sorting", async () => {
    hoisted.vendorFindMany.mockResolvedValue([
      {
        id: "vendor-2",
        name: "Metro Manager",
        businessName: "Metro Home Care Pros",
        email: "metro@example.com",
        phone: "555-0199",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        serviceAreas: "Orlando, Winter Park, Kissimmee",
        accountStatus: "active",
        accountStatusUpdatedAt: null,
        accountStatusReason: null,
        isPubliclyListed: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/admin/account-lookup?mode=browse&targetType=vendor&accountStatus=active&sort=alpha_asc")
    );

    expect(res.status).toBe(200);
    expect(hoisted.userFindMany).not.toHaveBeenCalled();
    expect(hoisted.vendorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountStatus: "active",
        }),
        orderBy: [{ businessName: "asc" }, { name: "asc" }],
      })
    );
    const json = await readJson(res);
    expect(json.results).toEqual([
      expect.objectContaining({
        targetType: "vendor",
        displayName: "Metro Home Care Pros",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        serviceAreas: "Orlando, Winter Park, Kissimmee",
      }),
    ]);
  });

  it("returns 503 when the database is temporarily unavailable", async () => {
    hoisted.userFindMany.mockRejectedValue(new Error("Can't reach database server at demo"));
    hoisted.vendorFindMany.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/admin/account-lookup?q=metro"));

    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.code).toBe(PUBLIC_DB_UNAVAILABLE_CODE);
    expect(String(json.error || "")).toContain("temporarily unavailable");
  });
});
