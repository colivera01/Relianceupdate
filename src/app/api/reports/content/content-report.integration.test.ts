import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireRequestActor } from "@/lib/request-actor";

const hoisted = vi.hoisted(() => {
  const reviewFindUnique = vi.fn();
  const mediaAssetFindUnique = vi.fn();
  const contentReportCreate = vi.fn();
  const contentReportUpdate = vi.fn();
  const adminNotificationCreate = vi.fn();
  const prisma = {
    review: { findUnique: reviewFindUnique },
    mediaAsset: { findUnique: mediaAssetFindUnique },
    contentReport: { create: contentReportCreate, update: contentReportUpdate },
    adminNotification: { create: adminNotificationCreate },
  };
  return {
    prisma,
    reviewFindUnique,
    mediaAssetFindUnique,
    contentReportCreate,
    contentReportUpdate,
    adminNotificationCreate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/request-actor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/request-actor")>();
  return {
    ...actual,
    requireRequestActor: vi.fn(),
  };
});

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("POST /api/reports/content", () => {
  beforeEach(() => {
    vi.mocked(requireRequestActor).mockReset();
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "user-1",
      email: "customer@reliance.test",
      accountStatus: "active",
      platformRoles: [],
      vendorMemberships: [],
    });
    hoisted.reviewFindUnique.mockReset();
    hoisted.mediaAssetFindUnique.mockReset();
    hoisted.contentReportCreate.mockReset();
    hoisted.contentReportUpdate.mockReset();
    hoisted.adminNotificationCreate.mockReset();
  });

  it("creates a review content report and admin notification for authenticated users", async () => {
    hoisted.reviewFindUnique.mockResolvedValue({
      id: "review-1",
      userId: "review-author-1",
      vendorId: "vendor-1",
      bookingId: "booking-1",
      moderationStatus: "approved",
      visibilityStatus: "public",
    });
    hoisted.contentReportCreate.mockResolvedValue({
      id: "report-1",
      targetType: "review",
      targetId: "review-1",
      status: "open",
      severity: "high",
    });
    hoisted.adminNotificationCreate.mockResolvedValue({ id: "notification-1" });
    hoisted.contentReportUpdate.mockResolvedValue({
      id: "report-1",
      targetType: "review",
      targetId: "review-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      reportedUserId: "review-author-1",
      reportedVendorId: "vendor-1",
      reporterUserId: "user-1",
      reporterVendorId: null,
      reporterRole: "customer",
      reasonCategory: "harassment",
      reasonDetail: "Threatening language",
      status: "open",
      severity: "high",
      autoHidden: false,
      notificationSentAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });

    const res = await POST(
      new Request("http://localhost/api/reports/content", {
        method: "POST",
        body: JSON.stringify({
          targetType: "review",
          targetId: "review-1",
          reasonCategory: "harassment",
          reasonDetail: "Threatening language",
          severity: "high",
        }),
      })
    );

    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: true,
      notificationId: "notification-1",
      report: {
        id: "report-1",
        targetType: "review",
        targetId: "review-1",
        reporterRole: "customer",
      },
    });
    expect(hoisted.contentReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: "review",
        targetId: "review-1",
        bookingId: "booking-1",
        vendorId: "vendor-1",
        reportedUserId: "review-author-1",
        reportedVendorId: "vendor-1",
        reporterUserId: "user-1",
        reporterRole: "customer",
        reasonCategory: "harassment",
        severity: "high",
        autoHidden: false,
      }),
    });
    expect(hoisted.adminNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: "vendor-1",
        type: "CONTENT_REPORT",
        title: "New review report",
      }),
    });
    expect(hoisted.contentReportUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: { notificationSentAt: expect.any(Date) },
      select: expect.objectContaining({ id: true, notificationSentAt: true }),
    });
  });

  it("defers guest reporting by requiring authentication", async () => {
    const { AuthorizationError } = await import("@/lib/request-actor");
    vi.mocked(requireRequestActor).mockRejectedValue(
      new AuthorizationError("UNAUTHENTICATED", "Sign in required.", 401)
    );

    const res = await POST(
      new Request("http://localhost/api/reports/content", {
        method: "POST",
        body: JSON.stringify({
          targetType: "media_asset",
          targetId: "asset-1",
          reasonCategory: "privacy",
        }),
      })
    );

    expect(res.status).toBe(401);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Sign in required.",
    });
    expect(hoisted.contentReportCreate).not.toHaveBeenCalled();
    expect(hoisted.adminNotificationCreate).not.toHaveBeenCalled();
  });

  it("does not accept a client-supplied admin role", async () => {
    hoisted.reviewFindUnique.mockResolvedValue({
      id: "review-1",
      userId: "review-author-1",
      vendorId: "vendor-1",
      bookingId: "booking-1",
      moderationStatus: "approved",
      visibilityStatus: "public",
    });
    hoisted.contentReportCreate.mockResolvedValue({
      id: "report-1",
      targetType: "review",
      targetId: "review-1",
      status: "open",
      severity: "medium",
    });
    hoisted.adminNotificationCreate.mockResolvedValue({ id: "notification-1" });
    hoisted.contentReportUpdate.mockResolvedValue({
      id: "report-1",
      reporterRole: "customer",
    });

    const res = await POST(
      new Request("http://localhost/api/reports/content", {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "review",
          targetId: "review-1",
          reasonCategory: "privacy",
          reporterRole: "admin",
        }),
      })
    );

    expect(res.status).toBe(201);
    expect(hoisted.contentReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reporterRole: "customer", reporterVendorId: null }),
    });
  });

  it("requires exact current membership for a vendor report", async () => {
    const res = await POST(
      new Request("http://localhost/api/reports/content", {
        method: "POST",
        headers: { "x-vendor-id": "vendor-foreign", "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "review",
          targetId: "review-1",
          reasonCategory: "privacy",
          reporterRole: "vendor",
          reporterVendorId: "vendor-foreign",
        }),
      })
    );

    expect(res.status).toBe(403);
    expect(hoisted.contentReportCreate).not.toHaveBeenCalled();
  });

  it("returns a truthful temporary-unavailable response on transient DB failures", async () => {
    hoisted.reviewFindUnique.mockRejectedValue(new Error("Can't reach database server at db.example:1433"));

    const res = await POST(
      new Request("http://localhost/api/reports/content", {
        method: "POST",
        body: JSON.stringify({
          targetType: "review",
          targetId: "review-1",
          reasonCategory: "privacy",
        }),
      })
    );

    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json).toMatchObject({
      success: false,
      code: "DB_UNAVAILABLE",
    });
    expect(String(json.error || "")).toContain("temporarily unavailable");
  });
});
