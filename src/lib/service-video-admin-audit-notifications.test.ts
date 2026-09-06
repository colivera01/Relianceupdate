import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  updateMany: vi.fn(),
  update: vi.fn(),
  emailAdmin: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  sendReady: vi.fn(),
  audit: vi.fn(),
  managers: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    bookingNotification: {
      updateMany: hoisted.updateMany,
      update: hoisted.update,
    },
    vendorMembership: { findMany: hoisted.managers },
  },
}));
vi.mock("@/lib/admin-notifications", () => ({
  tryEmailExistingAdminNotification: hoisted.emailAdmin,
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: hoisted.sendEmail }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: hoisted.sendSms }));
vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: hoisted.sendReady,
}));
vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.audit,
}));
vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: () => ({ emailEnabled: true, smsEnabled: false }),
}));

describe("core Admin Audit notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    hoisted.update.mockImplementation(({ data }: any) => Promise.resolve({ status: data.status }));
    hoisted.emailAdmin.mockResolvedValue({ emailSent: true });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
    hoisted.managers.mockResolvedValue([
      { user: { name: "Electro Manager", email: "manager@example.test" } },
    ]);
  });

  it("claims and sends the first actionable Admin Audit notice once", async () => {
    const { sendCoreAdminAuditReadyNotification } = await import(
      "./service-video-admin-audit-notifications"
    );

    const result = await sendCoreAdminAuditReadyNotification({
      notificationId: "admin-notification-1",
      bookingNotificationId: "booking-notification-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      packageId: "package-1",
      packageVersion: 2,
      actorUserId: "manager-1",
      baseUrl: "https://beta.example.test",
    });

    expect(result).toMatchObject({ claimed: true, status: "SENT", emailSent: true });
    expect(hoisted.emailAdmin).toHaveBeenCalledWith(expect.objectContaining({
      notificationId: "admin-notification-1",
      surfaceHref: "/admin/media-moderation?package=package-1",
      metadata: expect.objectContaining({ packageId: "package-1", packageVersion: 2 }),
    }));
  });

  it("does not duplicate a notification whose durable row is already claimed", async () => {
    hoisted.updateMany.mockResolvedValue({ count: 0 });
    const { sendCoreAdminAuditReadyNotification } = await import(
      "./service-video-admin-audit-notifications"
    );

    const result = await sendCoreAdminAuditReadyNotification({
      notificationId: "admin-notification-1",
      bookingNotificationId: "booking-notification-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      packageId: "package-1",
      packageVersion: 2,
      actorUserId: "manager-1",
    });

    expect(result).toEqual({ claimed: false, status: "already_processed" });
    expect(hoisted.emailAdmin).not.toHaveBeenCalled();
  });

  it("allows a failed durable notification to be claimed for retry without creating another row", async () => {
    hoisted.emailAdmin
      .mockResolvedValueOnce({ emailSent: false, emailError: "provider_unavailable" })
      .mockResolvedValueOnce({ emailSent: true });
    const { sendCoreAdminAuditReadyNotification } = await import(
      "./service-video-admin-audit-notifications"
    );
    const input = {
      notificationId: "admin-notification-1",
      bookingNotificationId: "booking-notification-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      packageId: "package-1",
      packageVersion: 2,
      actorUserId: "manager-1",
    };

    const failed = await sendCoreAdminAuditReadyNotification(input);
    const retried = await sendCoreAdminAuditReadyNotification(input);

    expect(failed).toMatchObject({ claimed: true, status: "FAILED", emailSent: false });
    expect(retried).toMatchObject({ claimed: true, status: "SENT", emailSent: true });
    expect(hoisted.updateMany).toHaveBeenCalledTimes(2);
    expect(hoisted.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "booking-notification-1",
        status: { in: ["QUEUED", "FAILED"] },
      }),
    }));
    expect(hoisted.emailAdmin).toHaveBeenCalledTimes(2);
  });

  it("sends a neutral rejection notice without internal moderation details or a video link", async () => {
    const { sendCorePrivateProofRejectedNotification } = await import(
      "./service-video-admin-audit-notifications"
    );

    const result = await sendCorePrivateProofRejectedNotification({
      notificationId: "customer-notification-1",
      actorUserId: "admin-1",
      bookingId: "booking-1",
      customerEmail: "customer@example.test",
      customerPhone: null,
      customerName: "Customer",
      serviceName: "Outlet Installation",
      vendorName: "Electro LLC",
    });

    expect(result).toMatchObject({ claimed: true, status: "SENT" });
    expect(hoisted.sendEmail).toHaveBeenCalledOnce();
    const message = hoisted.sendEmail.mock.calls[0][0];
    expect(message.subject).toContain("Service Videos");
    expect(message.text).toContain("were not released");
    expect(message.text).toContain("does not change the underlying service");
    expect(message.text).not.toContain("UNVERIFIABLE");
    expect(message.text).not.toContain("http");
  });

  it("sends an idempotent vendor PASS result with a read-only link and no Public implication", async () => {
    const { sendCoreAdminAuditVendorResultNotification } = await import(
      "./service-video-admin-audit-notifications"
    );
    const result = await sendCoreAdminAuditVendorResultNotification({
      notificationId: "vendor-pass-1",
      actorUserId: "admin-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      decision: "PASS",
      serviceName: "Outlet Installation",
      decidedAt: "2026-08-24T22:00:00.000Z",
      baseUrl: "https://beta.example.test",
    });

    expect(result).toMatchObject({ claimed: true, status: "SENT", recipientCount: 1 });
    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.text).toContain("Private Proof");
    expect(email.text).toContain("does not make any video Public");
    expect(email.text).toContain("/vendor/jobs/booking-1");
  });

  it("sends the controlled category and terminal language to the vendor on REJECT", async () => {
    const { sendCoreAdminAuditVendorResultNotification } = await import(
      "./service-video-admin-audit-notifications"
    );
    await sendCoreAdminAuditVendorResultNotification({
      notificationId: "vendor-reject-1",
      actorUserId: "admin-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      decision: "REJECT",
      serviceName: "Outlet Installation",
      rejectionCategory: "PRIVACY_OR_SCOPE",
      reason: "The recording exceeded the approved scope.",
      decidedAt: "2026-08-24T22:00:00.000Z",
      baseUrl: "https://beta.example.test",
    });

    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.text).toContain("Privacy or recording scope");
    expect(email.text).toContain("permanently closed");
    expect(email.text).toContain("does not mean the underlying real-world service failed");
    expect(email.text).toContain("rerecording, correction, retry, or resubmission is not available");
  });
});
