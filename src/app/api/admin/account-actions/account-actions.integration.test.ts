import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";

const hoisted = vi.hoisted(() => {
  const vendorFindUnique = vi.fn();
  const vendorUpdate = vi.fn();
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const serviceUpdateMany = vi.fn();
  const adminNotificationCreate = vi.fn();
  const prisma = {
    vendor: { findUnique: vendorFindUnique, update: vendorUpdate },
    user: { findUnique: userFindUnique, update: userUpdate },
    service: { updateMany: serviceUpdateMany },
    adminNotification: { create: adminNotificationCreate },
  };
  return {
    prisma,
    vendorFindUnique,
    vendorUpdate,
    userFindUnique,
    userUpdate,
    serviceUpdateMany,
    adminNotificationCreate,
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

describe("/api/admin/account-actions", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    vi.mocked(createAdminAuditLog).mockReset();
    vi.mocked(createAdminAuditLog).mockResolvedValue(undefined);
    hoisted.vendorFindUnique.mockReset();
    hoisted.vendorUpdate.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userUpdate.mockReset();
    hoisted.serviceUpdateMany.mockReset();
    hoisted.adminNotificationCreate.mockReset();
  });

  it("returns the current account status for admins", async () => {
    hoisted.userFindUnique.mockResolvedValue({
      id: "user-1",
      accountStatus: "active",
      accountStatusUpdatedAt: null,
      accountStatusReason: null,
      accountStatusAdminNotes: null,
    });

    const res = await GET(
      new Request("http://localhost/api/admin/account-actions?targetType=user&targetId=user-1")
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.account).toMatchObject({
      id: "user-1",
      targetType: "user",
      accountStatus: "active",
    });
    expect(hoisted.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({ accountStatus: true }),
    });
  });

  it("suspends a vendor, hides public surfaces, audits, and notifies admins", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({
      id: "vendor-1",
      accountStatus: "active",
      accountStatusUpdatedAt: null,
      accountStatusReason: null,
      accountStatusAdminNotes: null,
      isPubliclyListed: true,
      publiclyListedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    hoisted.vendorUpdate.mockResolvedValue({
      id: "vendor-1",
      accountStatus: "suspended",
      accountStatusUpdatedAt: new Date("2026-05-25T12:00:00.000Z"),
      accountStatusReason: "policy_violation",
      accountStatusAdminNotes: "Repeated unsafe behavior",
      isPubliclyListed: false,
      publiclyListedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    hoisted.serviceUpdateMany.mockResolvedValue({ count: 2 });
    hoisted.adminNotificationCreate.mockResolvedValue({ id: "notification-1" });

    const res = await POST(
      new Request("http://localhost/api/admin/account-actions", {
        method: "POST",
        body: JSON.stringify({
          targetType: "vendor",
          targetId: "vendor-1",
          action: "suspend",
          reasonCategory: "policy_violation",
          adminNotes: "Repeated unsafe behavior",
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.account).toMatchObject({
      id: "vendor-1",
      targetType: "vendor",
      accountStatus: "suspended",
      isPubliclyListed: false,
    });
    expect(hoisted.vendorUpdate).toHaveBeenCalledWith({
      where: { id: "vendor-1" },
      data: expect.objectContaining({
        accountStatus: "suspended",
        accountStatusReason: "policy_violation",
        accountStatusAdminNotes: "Repeated unsafe behavior",
        isPubliclyListed: false,
      }),
      select: expect.objectContaining({ isPubliclyListed: true }),
    });
    expect(hoisted.serviceUpdateMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", isPublished: true },
      data: { isPublished: false, publishedAt: null },
    });
    expect(createAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "ACCOUNT_SUSPENDED",
        entityType: "vendor",
        entityId: "vendor-1",
        actorUserId: "admin-1",
      })
    );
    expect(hoisted.adminNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: "vendor-1",
        type: "ACCOUNT_ACTION",
      }),
    });
  });

  it("rejects non-admin requests before changing data", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));

    const res = await POST(
      new Request("http://localhost/api/admin/account-actions", {
        method: "POST",
        body: JSON.stringify({
          targetType: "user",
          targetId: "user-1",
          action: "ban",
          reasonCategory: "fraud",
          adminNotes: "Chargeback abuse",
        }),
      })
    );

    expect(res.status).toBe(403);
    expect(hoisted.userUpdate).not.toHaveBeenCalled();
    expect(createAdminAuditLog).not.toHaveBeenCalled();
  });
});
