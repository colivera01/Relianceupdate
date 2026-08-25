import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  assetFindUnique: vi.fn(),
  assetUpdate: vi.fn(),
  packageFindFirst: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/server/db", () => ({
  prisma: {
    mediaAsset: {
      findUnique: hoisted.assetFindUnique,
      update: hoisted.assetUpdate,
    },
    serviceVideoPackageEvidence: {
      findFirst: hoisted.packageFindFirst,
    },
  },
}));

describe("individual Admin media moderation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.requireAdmin.mockResolvedValue({ userId: "admin-1" });
    hoisted.assetFindUnique.mockResolvedValue({
      id: "asset-1",
      moderationStatus: "pending_review",
      mediaSession: { bookingId: "booking-1" },
    });
  });

  it.each(["AWAITING_ADMIN_REVIEW", "PRIVATE_APPROVED", "ADMIN_REJECTED"])(
    "does not permit stage-level mutation for a core package in %s",
    async (status) => {
      hoisted.packageFindFirst.mockResolvedValue({ id: "package-1", status });
      const { PATCH } = await import("./route");
      const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/asset-1/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_customer_only" }),
      }), { params: Promise.resolve({ assetId: "asset-1" }) });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "CORE_ADMIN_AUDIT_PACKAGE_DECISION_REQUIRED",
      });
      expect(hoisted.packageFindFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          bookingId: "booking-1",
          auditEvidenceVersion: { not: null },
        }),
      }));
      expect(hoisted.assetUpdate).not.toHaveBeenCalled();
    },
  );
});
