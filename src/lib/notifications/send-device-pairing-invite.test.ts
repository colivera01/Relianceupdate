import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const sendSms = vi.fn();
  const readNotificationEnv = vi.fn();

  return {
    sendEmail,
    sendSms,
    readNotificationEnv,
  };
});

vi.mock("@/lib/email/resend", () => ({
  sendEmail: hoisted.sendEmail,
}));

vi.mock("@/lib/sms/twilio", () => ({
  sendSms: hoisted.sendSms,
}));

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: hoisted.readNotificationEnv,
}));

describe("sendDevicePairingInvite", () => {
  beforeEach(() => {
    hoisted.sendEmail.mockReset();
    hoisted.sendSms.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: false,
      resendApiKey: "test",
      emailFrom: "Reliance <noreply@example.com>",
      emailReplyTo: "",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioPhoneNumber: "",
      appBaseUrl: "http://localhost:3000",
    });
  });

  it("sends an email invite and reports disabled SMS honestly", async () => {
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });

    const { sendDevicePairingInvite } = await import("./send-device-pairing-invite");
    const result = await sendDevicePairingInvite({
      vendorName: "Metro Home Care Pros",
      inviteeEmail: "pair@example.net",
      inviteePhone: "(407) 555-0199",
      pairingUrl: "http://localhost:3000/device/pair?code=123456",
      pairingCode: "123456",
      expiresAtIso: "2026-06-01T12:00:00.000Z",
    });

    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendSms).not.toHaveBeenCalled();
    expect(result.anySuccess).toBe(true);
    expect(result.email.success).toBe(true);
    expect(result.sms.attempted).toBe(true);
    expect(result.sms.success).toBe(false);
    expect(result.sms.errorMessage).toBe("sms_disabled");
    expect(result.summaryMessage).toContain("Email sent");
  });

  it("falls back honestly when delivery attempts do not succeed", async () => {
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: true,
      resendApiKey: "test",
      emailFrom: "Reliance <noreply@example.com>",
      emailReplyTo: "",
      twilioAccountSid: "sid",
      twilioAuthToken: "token",
      twilioPhoneNumber: "+14075550100",
      appBaseUrl: "http://localhost:3000",
    });
    hoisted.sendEmail.mockResolvedValue({ ok: false, errorMessage: "email_failed" });
    hoisted.sendSms.mockResolvedValue({ ok: false, errorMessage: "sms_failed", errorCode: "30001" });

    const { sendDevicePairingInvite } = await import("./send-device-pairing-invite");
    const result = await sendDevicePairingInvite({
      vendorName: "Metro Home Care Pros",
      inviteeEmail: "pair@example.net",
      inviteePhone: "+14075550199",
      pairingUrl: "http://localhost:3000/device/pair?code=654321",
      pairingCode: "654321",
      expiresAtIso: "2026-06-01T12:00:00.000Z",
    });

    expect(result.anySuccess).toBe(false);
    expect(result.email.errorMessage).toBe("email_failed");
    expect(result.sms.errorMessage).toBe("sms_failed");
    expect(result.summaryMessage).toContain("link and backup code");
  });

  it("does not send a broken external invite when the pairing link is local only", async () => {
    const { sendDevicePairingInvite } = await import("./send-device-pairing-invite");
    const result = await sendDevicePairingInvite({
      vendorName: "Metro Home Care Pros",
      inviteeEmail: "pair@example.net",
      inviteePhone: "+14075550199",
      pairingUrl: "http://localhost:3000/device/pair?code=987654",
      pairingCode: "987654",
      expiresAtIso: "2026-06-01T12:00:00.000Z",
      linkAccessMode: "local_only",
    });

    expect(hoisted.sendEmail).not.toHaveBeenCalled();
    expect(hoisted.sendSms).not.toHaveBeenCalled();
    expect(result.anySuccess).toBe(false);
    expect(result.email.errorMessage).toBe("local_only_pairing_link");
    expect(result.sms.errorMessage).toBe("local_only_pairing_link");
    expect(result.summaryMessage).toContain("APP_BASE_URL");
  });
});
