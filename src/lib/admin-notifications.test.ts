import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const adminNotificationCreate = vi.fn();
  const sendEmail = vi.fn();
  const logNotificationAttempt = vi.fn();
  const readNotificationEnv = vi.fn();

  return {
    prisma: {
      adminNotification: {
        create: adminNotificationCreate,
      },
    },
    adminNotificationCreate,
    sendEmail,
    logNotificationAttempt,
    readNotificationEnv,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: hoisted.sendEmail,
}));

vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.logNotificationAttempt,
}));

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: hoisted.readNotificationEnv,
}));

describe("createAdminNotificationWithEmail", () => {
  beforeEach(() => {
    hoisted.adminNotificationCreate.mockReset();
    hoisted.sendEmail.mockReset();
    hoisted.logNotificationAttempt.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      appBaseUrl: "https://beta.relianceonline.org",
    });
  });

  it("creates the dashboard notification and emails the owner admin", async () => {
    hoisted.adminNotificationCreate.mockResolvedValue({
      id: "admin-notification-1",
    });
    hoisted.sendEmail.mockResolvedValue({
      ok: true,
      providerMessageId: "email-message-1",
    });

    const { createAdminNotificationWithEmail } = await import("./admin-notifications");

    const result = await createAdminNotificationWithEmail({
      vendorId: "vendor-1",
      type: "REVIEW_MODERATION_REQUIRED",
      title: "Customer review waiting for moderation",
      message: "A customer submitted a review that needs admin review.",
      metadata: {
        reviewId: "review-1",
        rating: 3,
      },
      surfaceHref: "/admin/reviews",
      actorUserId: "customer-1",
    });

    expect(hoisted.adminNotificationCreate).toHaveBeenCalledWith({
      data: {
        vendorId: "vendor-1",
        type: "REVIEW_MODERATION_REQUIRED",
        title: "Customer review waiting for moderation",
        message: "A customer submitted a review that needs admin review.",
        metadata: JSON.stringify({ reviewId: "review-1", rating: 3 }),
        read: false,
      },
    });
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendEmail.mock.calls[0][0]).toMatchObject({
      to: "colivera080124@gmail.com",
      subject: "Reliance admin action needed: Customer review waiting for moderation",
    });
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("https://beta.relianceonline.org/admin/reviews");
    expect(hoisted.logNotificationAttempt).toHaveBeenCalledWith("customer-1", "admin-notification-1", {
      kind: "admin_action_required",
      channel: "email",
      recipient: "colivera080124@gmail.com",
      success: true,
      providerMessageId: "email-message-1",
      fallbackLink: "https://beta.relianceonline.org/admin/reviews",
      errorMessage: undefined,
    });
    expect(result).toMatchObject({
      notification: { id: "admin-notification-1" },
      emailSent: true,
    });
  });
});
