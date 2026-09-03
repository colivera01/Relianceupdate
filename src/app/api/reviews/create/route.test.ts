import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const reviewCreate = vi.fn();
  const reviewWindowUpdate = vi.fn();
  const reviewWindowUpdateMany = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const employeeCustomerRatingCreate = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const mediaAssetFindFirst = vi.fn();
  const adminNotification = vi.fn();

  const prisma = {
    booking: { findUnique: bookingFindUnique },
    review: { findFirst: reviewFindFirst },
    vendorMembership: { findFirst: vendorMembershipFindFirst },
    mediaAsset: { findFirst: mediaAssetFindFirst },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        booking: { findUnique: bookingFindUnique },
        review: { findFirst: reviewFindFirst, create: reviewCreate },
        reviewWindow: {
          findFirst: vi.fn(async () => ({ id: "rw-1" })),
          update: reviewWindowUpdate,
          updateMany: reviewWindowUpdateMany,
        },
        reviewPromptEvent: { create: reviewPromptEventCreate },
        employeeCustomerRatingEvidence: { create: employeeCustomerRatingCreate },
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
    employeeCustomerRatingCreate,
    vendorMembershipFindFirst,
    mediaAssetFindFirst,
    adminNotification,
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

vi.mock("@/lib/admin-notifications", () => ({
  createAdminNotificationWithEmail: hoisted.adminNotification,
}));

vi.mock("@/lib/service-video-evidence", () => ({
  loadAuthorizedPrivateProof: vi.fn(async () => ({
    stages: [{ stage: "COMPLETED", mediaSessionId: "media-1" }],
  })),
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
    hoisted.employeeCustomerRatingCreate.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.mediaAssetFindFirst.mockReset();
    hoisted.adminNotification.mockReset().mockResolvedValue(undefined);
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
          attributionVersion: 3,
        }),
      })
    );
  });

  it("creates a separate optional employee rating without copying the vendor rating", async () => {
    hoisted.employeeCustomerRatingCreate.mockResolvedValue({ id: "employee-rating-1", rating: 3 });
    const response = await POST(reviewRequest({ employeeRating: 3 }));
    expect(response.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedMembershipId: "membership-1",
          assignedEmployeeName: "Hector Rivera",
          assignedUserId: "employee-user-1",
          attributionVersion: 3,
        }),
      })
    );
    expect(hoisted.employeeCustomerRatingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: "booking-1",
          vendorId: "vendor-1",
          employeeMembershipId: "membership-1",
          employeeUserId: "employee-user-1",
          rating: 3,
        }),
      })
    );
  });

  it("fails closed when an employee rating cannot be bound to one assigned professional", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      vendorId: "vendor-1",
      status: "COMPLETED",
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1", "membership-2"],
        vendor_job_assigned_employees: ["Hector Rivera", "Jordan Lee"],
      }),
    });

    const response = await POST(reviewRequest({ employeeRating: 4 }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMPLOYEE_RATING_ASSIGNMENT_AMBIGUOUS",
    });
    expect(hoisted.vendorMembershipFindFirst).not.toHaveBeenCalled();
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
  });

  it("binds the rating to the sole assignment instead of stale primary metadata", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      vendorId: "vendor-1",
      status: "COMPLETED",
      customerMetadata: JSON.stringify({
        vendor_job_primary_membership_id: "stale-membership",
        vendor_job_primary_employee: "Former Employee",
        vendor_job_assigned_membership_ids: ["membership-1"],
        vendor_job_assigned_employees: ["Hector Rivera"],
      }),
    });
    hoisted.employeeCustomerRatingCreate.mockResolvedValue({ id: "employee-rating-1", rating: 4 });

    const response = await POST(reviewRequest({ employeeRating: 4 }));
    expect(response.status).toBe(200);
    expect(hoisted.vendorMembershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "membership-1", vendorId: "vendor-1" } })
    );
    expect(hoisted.employeeCustomerRatingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeMembershipId: "membership-1",
          employeeNameSnapshot: "Hector Rivera",
        }),
      })
    );
  });

  it("does not queue text moderation for a star-only review", async () => {
    const response = await POST(reviewRequest({ comment: "" }));
    expect(response.status).toBe(200);
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ moderationStatus: "not_applicable", ratingValidityStatus: "verified" }),
    }));
    expect(hoisted.adminNotification).not.toHaveBeenCalled();
  });

  it("returns the original review for an identical idempotent retry", async () => {
    const requestId = "review-request-1";
    const first = await POST(reviewRequest({ requestId }));
    expect(first.status).toBe(200);
    const createdData = hoisted.reviewCreate.mock.calls[0][0].data;
    hoisted.reviewFindFirst.mockResolvedValue({
      id: "review-1",
      bookingId: "booking-1",
      submissionRequestId: requestId,
      submissionRequestHash: createdData.submissionRequestHash,
    });
    const retry = await POST(reviewRequest({ requestId }));
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ success: true, idempotent: true, review: { id: "review-1" } });
    expect(hoisted.reviewCreate).toHaveBeenCalledTimes(1);
  });

  it("fails closed when an idempotency key is reused with different content", async () => {
    hoisted.reviewFindFirst.mockResolvedValue({
      id: "review-1",
      submissionRequestId: "review-request-1",
      submissionRequestHash: "different-payload-hash",
    });
    const response = await POST(reviewRequest({ requestId: "review-request-1", rating: 2 }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "REVIEW_IDEMPOTENCY_CONFLICT" });
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
  });
});
