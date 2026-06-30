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
      "Reliance: Video consent request for Outlet Installation with Electro LLC."
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
      "Reliance: Your feedback window is open for Panel Inspection with Electro LLC."
    );
  });

  it("uses clear quick-rating links in customer review reminder email", async () => {
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: false,
      appBaseUrl: "https://relianceonline.org",
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    const { sendReviewReminderNotification } = await import("./send-review-reminder");

    await sendReviewReminderNotification({
      reviewWindowId: "review-window-1",
      actorUserId: "system",
      bookingId: "booking-1",
      customerEmail: "customer@example.com",
      vendorName: "Electro LLC",
      serviceName: "Panel Inspection",
    });

    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.html).toContain("Start with a quick rating:");
    expect(email.html).toContain("/reviews/quick?token=");
    expect(email.html).toContain("&amp;rating=5");
    expect(email.html).toContain("Start a 5 out of 5 star review");
    expect(email.html).not.toContain("&#9733;&#9733;");
    expect(email.text).toContain("5 stars: https://relianceonline.org/reviews/quick?token=");
    expect(email.text).toContain("&rating=5");
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
      "Reliance: Your feedback window for Electro LLC has closed."
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
      "Reliance: Employee invite connected to Electro LLC."
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
      "Reliance: Service order assigned for Electro LLC - Outlet Installation."
    );
  });

  it("keeps customer names out of employee service order email subjects", async () => {
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: false,
      appBaseUrl: "https://relianceonline.org",
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    const { sendJobAssignmentNotification } = await import("./send-job-assignment");

    await sendJobAssignmentNotification({
      bookingId: "booking-1",
      actorUserId: "vendor-user-1",
      employeeEmail: "employee@example.com",
      employeeName: "Adrian Olivera",
      employeeJobLink: "https://relianceonline.org/employee/jobs?jobId=booking-1",
      vendorName: "Electro LLC",
      jobTitle: "Ivan Olivera - Electrical Service Recording Test",
      customerName: "Ivan Olivera",
    });

    expect(hoisted.sendEmail.mock.calls[0][0].subject).toBe(
      "Reliance service order link: Electrical Service Recording Test"
    );
    expect(hoisted.sendEmail.mock.calls[0][0].text).toContain(
      "Electro LLC assigned you a service order."
    );
    expect(hoisted.sendEmail.mock.calls[0][0].text).toContain(
      "Job: Electrical Service Recording Test"
    );
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain('alt="Reliance"');
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("background:#050a12");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("reliance-email-logo.png");
  });
});
