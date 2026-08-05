import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendRecordingNotice } from "./recording-notice";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: vi.fn(() => ({ emailEnabled: true, smsEnabled: true })),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: vi.fn(async () => undefined),
}));
vi.mock("@/server/db", () => ({ prisma: {} }));

describe("customer recording notice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendEmail).mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    vi.mocked(sendSms).mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
  });

  it("sends an informational Level 1 notice without implying permission or publication", async () => {
    const result = await sendRecordingNotice({
      notificationId: "notice-1",
      bookingId: "job-1",
      actorUserId: "manager-1",
      customerName: "Alex",
      customerEmail: "alex@example.com",
      customerPhone: "+14075550123",
      vendorName: "Electro LLC",
      serviceName: "Outlet installation",
      scopeHash: "scope-hash",
    });

    expect(result.anySuccess).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alex@example.com",
        subject: expect.stringContaining("recording notice"),
        text: expect.stringMatching(/No response is required/),
        html: expect.stringMatching(/Recordings start Private/),
      }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14075550123",
        body: expect.stringMatching(/no people or audio/i),
      }),
    );
    const serialized = JSON.stringify([
      vi.mocked(sendEmail).mock.calls[0][0],
      vi.mocked(sendSms).mock.calls[0][0],
    ]);
    expect(serialized).not.toMatch(/allow recording|approve recording|public approval/i);
  });
});
