import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const reviewWindowFindUnique = vi.fn();
  const reviewFindFirst = vi.fn();
  const reviewCreate = vi.fn();
  const reviewWindowUpdate = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const reviewFindUnique = vi.fn();
  const reviewUpdate = vi.fn();
  const createAdminAuditLog = vi.fn();
  const verifyReviewEmailToken = vi.fn();

  const prisma = {
    reviewWindow: { findUnique: reviewWindowFindUnique },
    review: {
      findFirst: reviewFindFirst,
      findUnique: reviewFindUnique,
      update: reviewUpdate,
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        review: { create: reviewCreate },
        reviewWindow: { update: reviewWindowUpdate },
        reviewPromptEvent: { create: reviewPromptEventCreate },
      })
    ),
  };

  return {
    prisma,
    reviewWindowFindUnique,
    reviewFindFirst,
    reviewCreate,
    reviewWindowUpdate,
    reviewPromptEventCreate,
    reviewFindUnique,
    reviewUpdate,
    createAdminAuditLog,
    verifyReviewEmailToken,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: hoisted.createAdminAuditLog,
}));

vi.mock("@/lib/review-email-token", () => ({
  verifyReviewEmailToken: hoisted.verifyReviewEmailToken,
}));

function activeWindow() {
  return {
    id: "review-window-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    mediaSessionId: "media-1",
    status: "active",
    expiresAt: new Date(Date.now() + 60_000),
    reviewId: null,
    booking: {
      id: "booking-1",
      userId: "customer-1",
      vendorId: "vendor-1",
      title: "Panel repair",
      customerMetadata: JSON.stringify({
        vendor_job_primary_employee: "Assigned Worker",
        vendor_job_primary_membership_id: "membership-1",
      }),
      service: { name: "Electrical Service Recording Test" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
    },
    review: null,
  };
}

describe("quick email review", () => {
  beforeEach(() => {
    hoisted.reviewWindowFindUnique.mockReset();
    hoisted.reviewFindFirst.mockReset();
    hoisted.reviewCreate.mockReset();
    hoisted.reviewWindowUpdate.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    hoisted.reviewFindUnique.mockReset();
    hoisted.reviewUpdate.mockReset();
    hoisted.createAdminAuditLog.mockReset();
    hoisted.verifyReviewEmailToken.mockReset();
    hoisted.prisma.$transaction.mockClear();

    hoisted.verifyReviewEmailToken.mockReturnValue({ reviewWindowId: "review-window-1" });
    hoisted.reviewWindowFindUnique.mockResolvedValue(activeWindow());
    hoisted.reviewFindFirst.mockResolvedValue(null);
    hoisted.reviewCreate.mockImplementation(async ({ data }: any) => ({ id: "review-1", ...data }));
    hoisted.reviewWindowUpdate.mockResolvedValue({ id: "review-window-1", status: "submitted" });
    hoisted.reviewPromptEventCreate.mockResolvedValue({ id: "event-1" });
    hoisted.createAdminAuditLog.mockResolvedValue(undefined);
  });

  it("creates a vendor-level pending private review from an email star click", async () => {
    const { submitQuickEmailReviewRating } = await import("./quick-email-review");

    const result = await submitQuickEmailReviewRating({ token: "valid-token", rating: "4" });

    expect(result).toEqual(
      expect.objectContaining({
        status: "created",
        reviewId: "review-1",
        rating: 4,
        vendorId: "vendor-1",
      })
    );
    expect(hoisted.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor-1",
          bookingId: "booking-1",
          rating: 4,
          submittedVia: "email_link",
          assignedMembershipId: null,
          assignedEmployeeName: null,
          assignedUserId: null,
          moderationStatus: "pending_review",
          visibilityStatus: "private",
        }),
      })
    );
    expect(hoisted.reviewWindowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "review-window-1" },
        data: expect.objectContaining({ status: "submitted", reviewId: "review-1" }),
      })
    );
  });

  it("does not overwrite a review already saved for the booking", async () => {
    const { submitQuickEmailReviewRating } = await import("./quick-email-review");
    hoisted.reviewFindFirst.mockResolvedValue({ id: "review-existing", rating: 5, comment: null });

    const result = await submitQuickEmailReviewRating({ token: "valid-token", rating: "2" });

    expect(result).toEqual(
      expect.objectContaining({
        status: "already_submitted",
        reviewId: "review-existing",
        rating: 5,
        canAddComment: true,
      })
    );
    expect(hoisted.prisma.$transaction).not.toHaveBeenCalled();
    expect(hoisted.reviewCreate).not.toHaveBeenCalled();
  });
});
