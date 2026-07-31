import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const reviewCreate = vi.fn();
  const reviewWindowUpdate = vi.fn();
  const reviewWindowUpdateMany = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const mediaAssetFindFirst = vi.fn();

  const prisma = {
    booking: { findUnique: bookingFindUnique },
    review: { findFirst: reviewFindFirst },
    vendorMembership: { findFirst: vendorMembershipFindFirst },
    mediaAsset: { findFirst: mediaAssetFindFirst },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        review: { create: reviewCreate },
        reviewWindow: {
          update: reviewWindowUpdate,
          updateMany: reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: reviewPromptEventCreate },
      })
    ),
  };

  return {
    prisma,
    bookingFindUnique,
    reviewFindFirst,
    reviewCreate,
    reviewWindowUpdate,
    reviewWindowUpdateMany,
    reviewPromptEventCreate,
    vendorMembershipFindFirst,
    mediaAssetFindFirst,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/account-status", () => ({
  AccountStatusError: class AccountStatusError extends Error {
    statusCode = 403;
  },
  accountStatusErrorBody: vi.fn(() => ({ success: false })),
  ensureUserAccountCanAct: vi.fn(async () => undefined),
  ensureVendorAccountCanOperate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/email-verification-enforcement", () => ({
  requireVerifiedEmailForAction: vi.fn(async () => null),
}));

vi.mock("@/lib/review-capture", () => ({
  isValidSubmittedVia: vi.fn(() => true),
  assertReviewWindowActive: vi.fn(async () => ({
    ok: true,
    window: {
      id: "rw-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      mediaSessionId: "media-1",
    },
  })),
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn(async () => undefined),
}));

function reviewRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/reviews/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reviewWindowId: "rw-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      mediaSessionId: "media-1",
      rating: 5,
      comment: "Great service",
      submittedVia: "video_overlay",
      ...body,
    }),
  }) as any;
}

function setupBooking() {
  hoisted.bookingFindUnique.mockResolvedValue({
    id: "booking-1",
    userId: "user-1",
    vendorId: "vendor-1",
    status: "COMPLETED",
    customerMetadata: JSON.stringify({
      vendor_job_primary_membership_id: "membership-1",
      vendor_job_primary_employee: "Hector Rivera",
      vendor_job_assigned_membership_ids: ["membership-1"],
      vendor_job_assigned_employees: ["Hector Rivera"],
    }),
  });
  hoisted.reviewFindFirst.mockResolvedValue(null);
  hoisted.mediaAssetFindFirst.mockResolvedValue({ id: "asset-1" });
  hoisted.vendorMembershipFindFirst.mockResolvedValue({
    userId: "employee-user-1",
    user: { name: "Hector Rivera", email: "hector@example.com" },
  });
  hoisted.reviewCreate.mockImplementation(async ({ data }: any) => ({
    id: "review-1",
    ...data,
  }));
}

describe("POST /api/reviews/create attribution", () => {
  beforeEach(() => {
    hoisted.bookingFindUnique.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.reviewCreate.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    hoisted.reviewWindowUpdateMany.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.mediaAssetFindFirst.mockReset();
    hoisted.prisma.$transaction.mockClear();
    setupBooking();
  });

  it("does not attach employee attribution for overall business feedback", async () => {
    const response = await POST(reviewRequest({ reviewAttributionTarget: "overall_business" }));
    expect(response.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedMembershipId: null,
          assignedEmployeeName: null,
          assignedUserId: null,
          attributionVersion: 2,
        }),
      })
    );
  });

  it("attaches employee attribution only when the customer selects assigned worker or crew", async () => {
    const response = await POST(reviewRequest({ reviewAttributionTarget: "assigned_team" }));
    expect(response.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedMembershipId: "membership-1",
          assignedEmployeeName: "Hector Rivera",
          assignedUserId: "employee-user-1",
          attributionVersion: 2,
        }),
      })
    );
  });
});
