import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getVendorContext } from "@/app/api/vendor/context/route";
import { GET as getVendorProfile } from "@/app/api/vendor/profile/route";
import { GET as getDiscoverServices } from "@/app/api/services/discover/route";
import { GET as getServiceDetail, PUT as putServiceDetail, DELETE as deleteServiceDetail } from "@/app/api/services/[id]/route";
import { POST as postServices } from "@/app/api/services/route";
import { GET as getPublicVendor } from "@/app/api/vendors/[vendorId]/public/route";
import { PATCH as patchVendorPublish } from "@/app/api/admin/vendors/[vendorId]/publish/route";
import { PATCH as patchServicePublish } from "@/app/api/admin/services/[serviceId]/publish/route";
import { getUserIdFromRequest, verifyJwt } from "@/lib/auth";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";

const hoisted = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const vendorMembershipFindMany = vi.fn();
  const vendorMembershipFindUnique = vi.fn();
  const vendorFindUnique = vi.fn();
  const vendorFindFirst = vi.fn();
  const vendorUpdate = vi.fn();
  const serviceCount = vi.fn();
  const serviceFindMany = vi.fn();
  const serviceFindUnique = vi.fn();
  const serviceCreate = vi.fn();
  const serviceUpdate = vi.fn();
  const serviceDelete = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const promotionCampaignFindMany = vi.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    vendorMembership: { findMany: vendorMembershipFindMany, findUnique: vendorMembershipFindUnique },
    vendor: {
      findUnique: vendorFindUnique,
      findFirst: vendorFindFirst,
      update: vendorUpdate,
    },
    service: {
      count: serviceCount,
      findMany: serviceFindMany,
      findUnique: serviceFindUnique,
      create: serviceCreate,
      update: serviceUpdate,
      delete: serviceDelete,
    },
    mediaAsset: { findMany: mediaAssetFindMany },
    promotionCampaign: { findMany: promotionCampaignFindMany },
  };
  return {
    prisma,
    userFindUnique,
    vendorMembershipFindMany,
    vendorMembershipFindUnique,
    vendorFindUnique,
    vendorFindFirst,
    vendorUpdate,
    serviceCount,
    serviceFindMany,
    serviceFindUnique,
    serviceCreate,
    serviceUpdate,
    serviceDelete,
    mediaAssetFindMany,
    promotionCampaignFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
  verifyJwt: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/public-review-aggregates", () => ({
  getVendorReviewAggregatesForPublic: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

function mockActiveMembershipForVendorStatus(accountStatus: string) {
  hoisted.userFindUnique.mockResolvedValue({
    id: "user-1",
    accountStatus: "active",
  });
  hoisted.vendorMembershipFindMany.mockResolvedValue([
    {
      id: "membership-1",
      vendorId: "vendor-1",
      status: "ACTIVE",
      role: "MANAGER",
      requestedAt: new Date("2026-05-01T00:00:00.000Z"),
      approvedAt: new Date("2026-05-02T00:00:00.000Z"),
      vendor: {
        id: "vendor-1",
        name: "Restricted Vendor",
        businessName: "Restricted Vendor LLC",
        accountStatus,
      },
    },
  ]);
}

describe("restricted vendor regressions", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(verifyJwt).mockReset();
    vi.mocked(verifyJwt).mockResolvedValue({});
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    vi.mocked(createAdminAuditLog).mockReset();
    vi.mocked(createAdminAuditLog).mockResolvedValue(undefined);
    vi.mocked(getVendorReviewAggregatesForPublic).mockReset();
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(new Map());

    hoisted.userFindUnique.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.vendorMembershipFindUnique.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.vendorFindFirst.mockReset();
    hoisted.vendorUpdate.mockReset();
    hoisted.serviceCount.mockReset();
    hoisted.serviceFindMany.mockReset();
    hoisted.serviceFindUnique.mockReset();
    hoisted.serviceCreate.mockReset();
    hoisted.serviceUpdate.mockReset();
    hoisted.serviceDelete.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.promotionCampaignFindMany.mockReset();
    hoisted.promotionCampaignFindMany.mockResolvedValue([]);
  });

  it.each(["pending_approval", "suspended", "banned"])(
    "rejects vendor context for %s vendors",
    async (accountStatus) => {
      mockActiveMembershipForVendorStatus(accountStatus);

      const res = await getVendorContext(
        new Request("http://localhost/api/vendor/context", {
          headers: { "x-user-id": "user-1" },
        })
      );

      expect(res.status).toBe(403);
      const json = await readJson(res);
      expect(json).toMatchObject({
        success: false,
        code: "VENDOR_ACCOUNT_RESTRICTED",
        context: {
          state: "RESTRICTED",
          accountType: "vendor",
          accountStatus,
          vendorId: "vendor-1",
        },
      });
    }
  );

  it("rejects restricted vendor profile reads before exposing profile data", async () => {
    mockActiveMembershipForVendorStatus("suspended");

    const res = await getVendorProfile(
      new Request("http://localhost/api/vendor/profile", {
        headers: { "x-user-id": "user-1" },
      })
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountType: "vendor",
      accountStatus: "suspended",
    });
    expect(hoisted.vendorFindUnique).not.toHaveBeenCalled();
  });

  it("requires active vendors in public discovery and public vendor profile queries", async () => {
    hoisted.serviceCount.mockResolvedValue(0);
    hoisted.serviceFindMany.mockResolvedValue([]);
    hoisted.vendorFindFirst.mockResolvedValue(null);

    const discoverRes = await getDiscoverServices(
      new Request("http://localhost/api/services/discover") as any
    );
    const publicVendorRes = await getPublicVendor(
      new Request("http://localhost/api/vendors/vendor-1/public"),
      { params: Promise.resolve({ vendorId: "vendor-1" }) }
    );

    expect(discoverRes.status).toBe(200);
    expect(hoisted.serviceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          vendor: expect.objectContaining({
            isPubliclyListed: true,
            accountStatus: "active",
          }),
        }),
      })
    );
    expect(publicVendorRes.status).toBe(404);
    expect(hoisted.vendorFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "vendor-1",
          isPubliclyListed: true,
          accountStatus: "active",
        }),
      })
    );
  });

  it("hides public service detail data for restricted vendors", async () => {
    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      name: "Restricted Service",
      description: "Should not be public",
      price: 100,
      isPublished: true,
      vendor: {
        id: "vendor-1",
        name: "Restricted Vendor",
        businessName: "Restricted Vendor LLC",
        isPubliclyListed: true,
        accountStatus: "banned",
      },
    });

    const res = await getServiceDetail(
      new Request("http://localhost/api/services/service-1") as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(res.status).toBe(404);
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
    expect(vi.mocked(getVendorReviewAggregatesForPublic)).not.toHaveBeenCalled();
  });

  it("rejects admin attempts to publicly list a pending-approval vendor", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({
      id: "vendor-1",
      isPubliclyListed: false,
      publiclyListedAt: null,
      accountStatus: "pending_approval",
    });

    const res = await patchVendorPublish(
      new Request("http://localhost/api/admin/vendors/vendor-1/publish", {
        method: "PATCH",
        body: JSON.stringify({ isPubliclyListed: true }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1" }) }
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountStatus: "pending_approval",
    });
    expect(hoisted.vendorUpdate).not.toHaveBeenCalled();
    expect(createAdminAuditLog).not.toHaveBeenCalled();
  });

  it("rejects admin attempts to publish a service owned by a suspended vendor", async () => {
    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      isPublished: false,
      publishedAt: null,
      vendor: { accountStatus: "suspended" },
    });

    const res = await patchServicePublish(
      new Request("http://localhost/api/admin/services/service-1/publish", {
        method: "PATCH",
        body: JSON.stringify({ isPublished: true }),
      }),
      { params: Promise.resolve({ serviceId: "service-1" }) }
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountStatus: "suspended",
    });
    expect(hoisted.serviceUpdate).not.toHaveBeenCalled();
    expect(createAdminAuditLog).not.toHaveBeenCalled();
  });

  it.each(["pending_approval", "suspended", "banned"])(
    "rejects service creation for %s vendors",
    async (accountStatus) => {
      hoisted.vendorFindUnique.mockResolvedValue({
        id: "vendor-1",
        accountStatus,
      });

      const res = await postServices(
        new Request("http://localhost/api/services", {
          method: "POST",
          body: JSON.stringify({
            vendorId: "vendor-1",
            name: "Restricted service",
            description: "Should not be created",
            price: 100,
          }),
        }) as any
      );

      expect(res.status).toBe(403);
      const json = await readJson(res);
      expect(json).toMatchObject({
        success: false,
        code: "VENDOR_ACCOUNT_RESTRICTED",
        accountType: "vendor",
        accountStatus,
      });
      expect(hoisted.serviceCreate).not.toHaveBeenCalled();
    }
  );

  it("rejects service updates for restricted vendors before mutating service rows", async () => {
    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      isPublished: false,
      publishedAt: null,
      vendor: { accountStatus: "suspended" },
    });

    const res = await putServiceDetail(
      new Request("http://localhost/api/services/service-1", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated name" }),
      }) as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountType: "vendor",
      accountStatus: "suspended",
    });
    expect(hoisted.serviceUpdate).not.toHaveBeenCalled();
  });

  it("rejects service deletes for restricted vendors before deleting service rows", async () => {
    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendor: { accountStatus: "banned" },
    });

    const res = await deleteServiceDetail(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
      }) as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountType: "vendor",
      accountStatus: "banned",
    });
    expect(hoisted.serviceDelete).not.toHaveBeenCalled();
  });

  it.each(["pending_approval", "suspended", "banned"])(
    "rejects membership-gated operation helpers for %s vendors",
    async (accountStatus) => {
      hoisted.userFindUnique.mockResolvedValue({
        id: "user-1",
        accountStatus: "active",
      });
      hoisted.vendorFindUnique.mockResolvedValue({
        id: "vendor-1",
        accountStatus,
      });

      const request = new Request("http://localhost/api/vendors/vendor-1/jobs", {
        headers: { "x-user-id": "user-1" },
      });

      await expect(requireVendorMembership(request, "vendor-1")).rejects.toMatchObject({
        code: "VENDOR_ACCOUNT_RESTRICTED",
        accountType: "vendor",
        accountStatus,
      });
      await expect(requireVendorManager(request, "vendor-1")).rejects.toMatchObject({
        code: "VENDOR_ACCOUNT_RESTRICTED",
        accountType: "vendor",
        accountStatus,
      });
      expect(hoisted.vendorMembershipFindUnique).not.toHaveBeenCalled();
    }
  );
});
