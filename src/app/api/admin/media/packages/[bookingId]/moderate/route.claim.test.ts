import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const mediaAssetUpdate = vi.fn();
  const sendVideoReadyNotification = vi.fn();
  const sendVideoPackageApprovedNotification = vi.fn();

  return {
    bookingFindUnique,
    bookingUpdate,
    mediaAssetFindMany,
    mediaAssetUpdate,
    sendVideoReadyNotification,
    sendVideoPackageApprovedNotification,
    prisma: {
      booking: {
        findUnique: bookingFindUnique,
        update: bookingUpdate,
      },
      mediaAsset: {
        findMany: mediaAssetFindMany,
        update: mediaAssetUpdate,
      },
    },
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1" })),
}));
vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: hoisted.sendVideoReadyNotification,
}));
vi.mock("@/lib/notifications/send-video-package-approved", () => ({
  sendVideoPackageApprovedNotification:
    hoisted.sendVideoPackageApprovedNotification,
}));
vi.mock("@/lib/trust-score-outcome-foundation", () => ({
  TRUST_OUTCOME_TYPES: { MEDIA_PACKAGE_APPROVED: "MEDIA_PACKAGE_APPROVED" },
  tryRecordFinalizedOperationalOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/trust-score-calculator", () => ({
  tryRecalculateVendorTrustScore: vi.fn(async () => undefined),
}));

describe("completed work-order customer invitation", () => {
  beforeEach(() => {
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.mediaAssetUpdate.mockReset();
    hoisted.sendVideoReadyNotification.mockReset();
    hoisted.sendVideoPackageApprovedNotification.mockReset();
    hoisted.sendVideoReadyNotification.mockResolvedValue({ ok: true });
    hoisted.sendVideoPackageApprovedNotification.mockResolvedValue({
      anySuccess: true,
    });
  });

  it("emails an unclaimed customer a secure claim link without storing the raw token", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "b1",
      vendorId: "v1",
      title: "HVAC tune-up",
      clientName: "Alex",
      userId: "placeholder-1",
      customerMetadata: JSON.stringify({
        claim_status: "UNCLAIMED",
        claim_contact_email: "alex@example.com",
      }),
      user: {
        email: "unclaimed+b1@reliance.local",
        name: "Alex",
        phone: null,
      },
      vendor: {
        businessName: "A Heating",
        name: "Vendor A",
        email: "manager@example.com",
        phone: null,
        memberships: [],
      },
      service: { name: "HVAC" },
    });
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "a-intro",
        moderationStatus: "pending_review",
        mediaSession: { vendorJobVideoStage: "INTRO" },
      },
      {
        id: "a-progress",
        moderationStatus: "pending_review",
        mediaSession: { vendorJobVideoStage: "IN_PROGRESS" },
      },
      {
        id: "a-completed",
        moderationStatus: "pending_review",
        mediaSession: { vendorJobVideoStage: "COMPLETED" },
      },
    ]);
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset",
      moderationStatus: "approved",
      visibilityStatus: "customer_only",
      moderationReason: null,
      moderatedAt: new Date("2026-04-15T10:00:00.000Z"),
      moderatedByUserId: "admin-1",
    });
    hoisted.bookingUpdate.mockResolvedValue({ id: "b1" });

    const response = await PATCH(
      new Request(
        "https://beta.relianceonline.org/api/admin/media/packages/b1/moderate",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve",
            visibility: "customer_only",
          }),
        }
      ),
      { params: Promise.resolve({ bookingId: "b1" }) }
    );

    expect(response.status).toBe(200);
    const notificationInput =
      hoisted.sendVideoReadyNotification.mock.calls[0][0];
    expect(notificationInput.videoUrl).toMatch(
      /\/my-bookings\/b1\?videoReady=1&claimToken=/
    );
    const rawToken = new URL(
      notificationInput.videoUrl,
      "https://beta.relianceonline.org"
    ).searchParams.get("claimToken");
    expect(rawToken).toBeTruthy();

    const updateInput = hoisted.bookingUpdate.mock.calls[0][0];
    const metadata = JSON.parse(updateInput.data.customerMetadata);
    expect(metadata.customer_booking_claim_token_hash).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(metadata.customer_booking_claim_token_hash).not.toBe(rawToken);
    expect(metadata.proof_ready_notification_url).not.toContain("claimToken");
  });
});
