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

describe("vendor-attributed SMS copy", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.sendEmail.mockReset();
    hoisted.sendSms.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.logNotificationAttempt.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: false,
      smsEnabled: true,
      appBaseUrl: "https://relianceonline.org",
    });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
  });

  it("identifies the vendor in service video consent SMS", async () => {
    const { sendConsentLinkNotification } = await import("./send-consent-link");

    await sendConsentLinkNotification({
      consentRecordId: "consent-1",
      actorUserId: "vendor-user-1",
      token: "token-1",
      consentPath: "/consent/token-1",
      customerPhone: "4075550199",
      vendorName: "Electro LLC",
      serviceName: "Outlet Installation",
    });

    expect(hoisted.sendSms.mock.calls[0][0].body).toContain(
      "Electro LLC via Reliance: service video consent request for Outlet Installation."
    );
  });

  it("identifies the vendor in customer review reminder SMS", async () => {
    const { sendReviewReminderNotification } = await import("./send-review-reminder");

    await sendReviewReminderNotification({
      reviewWindowId: "review-window-1",
      actorUserId: "system",
      bookingId: "booking-1",
      customerPhone: "4075550199",
      vendorName: "Electro LLC",
      serviceName: "Panel Inspection",
    });

    expect(hoisted.sendSms.mock.calls[0][0].body).toContain(
      "Electro LLC via Reliance: your feedback window is open for Panel Inspection."
    );
  });

  it("identifies the vendor when a review window closes", async () => {
    const { sendReviewExpiredNotification } = await import("./send-review-expired");

    await sendReviewExpiredNotification({
      reviewWindowId: "review-window-1",
      actorUserId: "system",
      bookingId: "booking-1",
      customerPhone: "4075550199",
      vendorName: "Electro LLC",
    });

    expect(hoisted.sendSms.mock.calls[0][0].body).toContain(
      "Electro LLC via Reliance: your feedback window has closed."
    );
  });

  it("identifies the vendor in employee invite SMS", async () => {
    const { sendEmployeeInviteNotification } = await import("./send-employee-invite");

    await sendEmployeeInviteNotification({
      inviteId: "invite-1",
      actorUserId: "vendor-user-1",
      inviteLink: "https://relianceonline.org/vendor/invite/token-1",
      vendorName: "Electro LLC",
      inviteePhone: "4075550199",
    });

    expect(hoisted.sendSms.mock.calls[0][0].body).toContain(
      "Electro LLC via Reliance: employee invite to join their team."
    );
  });

  it("identifies the vendor in employee job assignment SMS", async () => {
    const { sendJobAssignmentNotification } = await import("./send-job-assignment");

    await sendJobAssignmentNotification({
      bookingId: "booking-1",
      actorUserId: "vendor-user-1",
      employeePhone: "4075550199",
      employeeJobLink: "https://relianceonline.org/employee/jobs?jobId=booking-1",
      vendorName: "Electro LLC",
      jobTitle: "Outlet Installation",
    });

    expect(hoisted.sendSms.mock.calls[0][0].body).toContain(
      "Electro LLC via Reliance: new job assigned - Outlet Installation."
    );
  });
});
