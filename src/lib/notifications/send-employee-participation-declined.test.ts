import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  claim: vi.fn(),
  findNotification: vi.fn(),
  update: vi.fn(),
  managers: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    bookingNotification: {
      updateMany: hoisted.claim,
      findFirst: hoisted.findNotification,
      update: hoisted.update,
    },
    vendorMembership: { findMany: hoisted.managers },
  },
}));
vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: () => ({
    emailEnabled: true,
    smsEnabled: true,
    appBaseUrl: "https://beta.example.test",
  }),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: hoisted.sendEmail }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: hoisted.sendSms }));
vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.audit,
}));

describe("Employee recording-participation DECLINE notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.claim.mockResolvedValue({ count: 1 });
    hoisted.findNotification.mockResolvedValue({
      bookingId: "booking-1",
      booking: {
        id: "booking-1",
        title: "Outlet Installation",
        vendorId: "vendor-1",
        service: { name: "Electrical work" },
        vendor: { name: "Electro LLC", businessName: "Electro LLC" },
      },
    });
    hoisted.managers.mockResolvedValue([
      {
        id: "manager-membership-1",
        user: {
          name: "Morgan Manager",
          email: "manager@example.test",
          phone: "4075550100",
        },
      },
    ]);
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
    hoisted.update.mockResolvedValue({ status: "SENT" });
  });

  it("claims the durable BookingNotification once and sends the manager email/SMS", async () => {
    const { dispatchEmployeeParticipationDeclinedNotification } = await import(
      "./send-employee-participation-declined"
    );

    const result = await dispatchEmployeeParticipationDeclinedNotification({
      notificationId: "notification-1",
      actorUserId: "employee-1",
      baseUrl: "https://beta.example.test/api/employee/jobs/booking-1/recording-participation",
    });

    expect(result).toMatchObject({ claimed: true, status: "SENT" });
    expect(hoisted.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "manager@example.test",
      subject: "Employee recording participation declined: Outlet Installation",
    }));
    expect(hoisted.sendSms).toHaveBeenCalledWith(expect.objectContaining({
      to: "+14075550100",
      body: expect.stringContaining("/vendor/jobs/booking-1"),
    }));
    expect(hoisted.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification-1" },
      data: expect.objectContaining({ status: "SENT", lastError: null }),
    }));
    expect(hoisted.audit).toHaveBeenCalledTimes(2);
  });

  it("does not send again when the durable row was already claimed", async () => {
    hoisted.claim.mockResolvedValue({ count: 0 });
    const { dispatchEmployeeParticipationDeclinedNotification } = await import(
      "./send-employee-participation-declined"
    );

    const result = await dispatchEmployeeParticipationDeclinedNotification({
      notificationId: "notification-1",
      actorUserId: "employee-1",
    });

    expect(result).toEqual({ claimed: false, status: "already_processed", channels: [] });
    expect(hoisted.sendEmail).not.toHaveBeenCalled();
    expect(hoisted.sendSms).not.toHaveBeenCalled();
  });
});
