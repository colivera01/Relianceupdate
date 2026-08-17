import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendPermissionWrongRecipientNotification } from "./send-permission-wrong-recipient";

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { vendorMembership: { findMany: hoisted.findMany } },
}));
vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: () => ({ emailEnabled: true, smsEnabled: true }),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: hoisted.sendEmail }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: hoisted.sendSms }));
vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.log,
}));

describe("wrong-recipient vendor notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.findMany.mockResolvedValue([
      {
        user: {
          name: "Vendor Manager",
          email: "manager@example.test",
          phone: "+14075550199",
        },
      },
    ]);
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
    hoisted.log.mockResolvedValue(undefined);
  });

  it("alerts active managers without including permission secrets", async () => {
    const results = await sendPermissionWrongRecipientNotification({
      bookingId: "booking-1",
      consentRecordId: "permission-1",
      vendorId: "vendor-1",
      vendorName: "Controlled Services",
      serviceOrderTitle: "Outlet installation",
    });

    expect(results).toEqual([
      { channel: "email", success: true },
      { channel: "sms", success: true },
    ]);
    expect(hoisted.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager@example.test",
        subject: expect.stringContaining("Correct the recording-permission recipient"),
      }),
    );
    expect(hoisted.sendSms).toHaveBeenCalled();
    expect(JSON.stringify(hoisted.sendEmail.mock.calls)).not.toContain("permission-1");
    expect(JSON.stringify(hoisted.sendSms.mock.calls)).not.toContain("permission-1");
  });
});
