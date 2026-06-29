import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const sendSms = vi.fn();
  const readNotificationEnv = vi.fn();
  const logNotificationAttempt = vi.fn();

  return {
    sendEmail,
    sendSms,
    readNotificationEnv,
    logNotificationAttempt,
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

vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.logNotificationAttempt,
}));

describe("sendVideoReadyNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.sendEmail.mockReset();
    hoisted.sendSms.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.logNotificationAttempt.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: true,
      appBaseUrl: "https://relianceonline.org",
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
  });

  it("sends customer video-ready notification through email and SMS", async () => {
    const { sendVideoReadyNotification } = await import("./send-video-ready");

    const result = await sendVideoReadyNotification({
      actorUserId: "admin-1",
      bookingId: "booking-1",
      customerEmail: "customer@example.com",
      customerPhone: "(407) 555-0199",
      customerName: "Alex",
      serviceName: "Apartment Cleaning",
      vendorName: "Metro Home Care Pros",
      videoUrl: "https://relianceonline.org/my-bookings/booking-1?videoReady=1",
    });

    expect(result.ok).toBe(true);
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendSms).toHaveBeenCalledTimes(1);
    expect(hoisted.sendSms.mock.calls[0][0]).toMatchObject({
      to: "+14075550199",
    });
    expect(hoisted.sendSms.mock.calls[0][0].body).toContain("Reliance:");
    expect(hoisted.sendSms.mock.calls[0][0].body).toContain("from Metro Home Care Pros");
    expect(hoisted.sendSms.mock.calls[0][0].body).toContain("Starting Condition");
    expect(hoisted.sendSms.mock.calls[0][0].body).toContain("Reply STOP to opt out");
    expect(result.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "email", attempted: true, success: true }),
        expect.objectContaining({ channel: "sms", attempted: true, success: true }),
      ])
    );
  });

  it("does not fail email delivery just because no customer phone exists", async () => {
    const { sendVideoReadyNotification } = await import("./send-video-ready");

    const result = await sendVideoReadyNotification({
      actorUserId: "admin-1",
      bookingId: "booking-1",
      customerEmail: "customer@example.com",
      customerPhone: null,
      customerName: "Alex",
      serviceName: "Apartment Cleaning",
      videoUrl: "https://relianceonline.org/my-bookings/booking-1?videoReady=1",
    });

    expect(result.ok).toBe(true);
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendSms).not.toHaveBeenCalled();
    expect(result.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "sms", attempted: false, success: false, errorMessage: "no_customer_phone" }),
      ])
    );
  });
});
