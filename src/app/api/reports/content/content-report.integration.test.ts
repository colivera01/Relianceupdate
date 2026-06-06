import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getUserIdFromRequest, getVendorIdFromRequest } from "@/lib/auth";

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

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
  getVendorIdFromRequest: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("POST /api/reports/content", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getVendorIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getVendorIdFromRequest).mockResolvedValue(null);
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
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    vi.mocked(getVendorIdFromRequest).mockResolvedValue(null);

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
    expect(json.message).toContain("Guest reporting is deferred");
    expect(hoisted.contentReportCreate).not.toHaveBeenCalled();
    expect(hoisted.adminNotificationCreate).not.toHaveBeenCalled();
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
