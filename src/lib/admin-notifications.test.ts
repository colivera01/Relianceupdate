import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const adminNotificationCreate = vi.fn();
  const sendEmail = vi.fn();
  const logNotificationAttempt = vi.fn();
  const readNotificationEnv = vi.fn();
  const isAiFeatureEnabled = vi.fn();
  const getAdminNotificationEmailSummary = vi.fn();

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
    isAiFeatureEnabled,
    getAdminNotificationEmailSummary,
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

vi.mock("@/lib/ai/feature-flags", () => ({
  isAiFeatureEnabled: hoisted.isAiFeatureEnabled,
}));

vi.mock("@/lib/ai/admin-notification-email-summary", () => ({
  getAdminNotificationEmailSummary: hoisted.getAdminNotificationEmailSummary,
}));

describe("createAdminNotificationWithEmail", () => {
  beforeEach(() => {
    hoisted.adminNotificationCreate.mockReset();
    hoisted.sendEmail.mockReset();
    hoisted.logNotificationAttempt.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.isAiFeatureEnabled.mockReset();
    hoisted.getAdminNotificationEmailSummary.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      appBaseUrl: "https://beta.relianceonline.org",
    });
    hoisted.isAiFeatureEnabled.mockReturnValue(false);
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

  it("rejects internal deployment hosts when building admin email links and logos", async () => {
    hoisted.adminNotificationCreate.mockResolvedValue({
      id: "admin-notification-internal-host-1",
    });
    hoisted.sendEmail.mockResolvedValue({
      ok: true,
      providerMessageId: "email-message-internal-host-1",
    });

    const { createAdminNotificationWithEmail } = await import("./admin-notifications");

    await createAdminNotificationWithEmail({
      type: "VENDOR_APPROVAL_REQUIRED",
      title: "New vendor approval request",
      message: "A vendor profile needs admin approval.",
      metadata: {
        vendorId: "vendor-1",
        businessName: "Test Vendor",
      },
      surfaceHref: "/admin/vendors/approval-queue",
      baseUrl: "https://4a63f37da1dd:8080",
    });

    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.html).toContain("https://beta.relianceonline.org/reliance-email-logo.png");
    expect(email.html).toContain("https://beta.relianceonline.org/admin/vendors/approval-queue");
    expect(email.html).not.toContain("4a63f37da1dd");
    expect(hoisted.logNotificationAttempt.mock.calls[0][2].fallbackLink).toBe(
      "https://beta.relianceonline.org/admin/vendors/approval-queue"
    );
  });

  it("adds an AI summary block to admin action emails when support triage AI is enabled", async () => {
    hoisted.adminNotificationCreate.mockResolvedValue({
      id: "admin-notification-ai-1",
    });
    hoisted.sendEmail.mockResolvedValue({
      ok: true,
      providerMessageId: "email-message-ai-1",
    });
    hoisted.isAiFeatureEnabled.mockReturnValue(true);
    hoisted.getAdminNotificationEmailSummary.mockResolvedValue({
      summary: "A customer quick review is ready for admin moderation.",
      riskLevel: "medium",
      whyItMatters: "The rating should not affect public metrics until you approve it.",
      suggestedNextAction: "Open the review moderation queue and confirm whether it should be approved.",
      confidence: "medium",
    });

    const { createAdminNotificationWithEmail } = await import("./admin-notifications");

    await createAdminNotificationWithEmail({
      vendorId: "vendor-1",
      type: "QUICK_REVIEW_MODERATION_REQUIRED",
      title: "Customer quick review waiting for moderation",
      message: "A customer submitted a 5-star quick review from email.",
      metadata: {
        reviewId: "review-quick-1",
        rating: 5,
      },
      surfaceHref: "/admin/reviews",
      actorUserId: "customer-1",
    });

    expect(hoisted.getAdminNotificationEmailSummary).toHaveBeenCalledWith(
      {
        notificationId: "admin-notification-ai-1",
        type: "QUICK_REVIEW_MODERATION_REQUIRED",
        title: "Customer quick review waiting for moderation",
        message: "A customer submitted a 5-star quick review from email.",
        details: [
          { label: "Notification Type", value: "QUICK_REVIEW_MODERATION_REQUIRED" },
          { label: "Notification ID", value: "admin-notification-ai-1" },
          { label: "Review Id", value: "review-quick-1" },
          { label: "Rating", value: "5" },
        ],
        adminUrl: "https://beta.relianceonline.org/admin/reviews",
      },
      "customer-1"
    );

    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.html).toContain("AI Admin Summary");
    expect(email.html).toContain("A customer quick review is ready for admin moderation.");
    expect(email.html).toContain("Risk level:");
    expect(email.text).toContain("AI admin summary:");
    expect(email.text).toContain("Suggested next action: Open the review moderation queue");
  });
});
