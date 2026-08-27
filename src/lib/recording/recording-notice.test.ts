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

  it("uses canonical Video-only wording across email, plain text, and SMS", async () => {
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
      audioEnabled: false,
    });

    expect(result.anySuccess).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alex@example.com",
        subject: expect.stringContaining("recording notice"),
        text: expect.stringMatching(/Audio will not be recorded\./),
        html: expect.stringMatching(/Audio will not be recorded\./),
      }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14075550123",
        body: expect.stringMatching(/Audio will not be recorded\./),
      }),
    );
    const serialized = JSON.stringify([
      vi.mocked(sendEmail).mock.calls[0][0],
      vi.mocked(sendSms).mock.calls[0][0],
    ]);
    expect(serialized).not.toMatch(/allow recording|approve recording|public approval/i);
    expect(serialized).not.toMatch(/audio is included|video-and-audio/i);
  });

  it("uses canonical Video+Audio wording without a Video-only contradiction", async () => {
    await sendRecordingNotice({
      notificationId: "notice-audio-1",
      bookingId: "job-audio-1",
      actorUserId: "manager-1",
      customerName: "Alex",
      customerEmail: "alex@example.com",
      customerPhone: "+14075550123",
      vendorName: "Electro LLC",
      serviceName: "Outlet installation",
      scopeHash: "scope-hash-audio",
      audioEnabled: true,
    });

    const serialized = JSON.stringify([
      vi.mocked(sendEmail).mock.calls[0][0],
      vi.mocked(sendSms).mock.calls[0][0],
    ]);
    expect(serialized).toMatch(/video-and-audio/i);
    expect(serialized).toMatch(/include sound because audio is part of documenting the service/i);
    expect(serialized).not.toMatch(/Audio will not be recorded|Audio is off|video-only|no people or audio/i);
  });
});
