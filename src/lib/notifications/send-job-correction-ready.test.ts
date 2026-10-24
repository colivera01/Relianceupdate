import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  readNotificationEnv: vi.fn(),
  logNotificationAttempt: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({ sendEmail: hoisted.sendEmail }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: hoisted.sendSms }));
vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: hoisted.readNotificationEnv,
}));
vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: hoisted.logNotificationAttempt,
}));

describe("sendJobCorrectionReadyNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(hoisted).forEach((mock) => mock.mockReset());
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: true,
      appBaseUrl: "https://beta.relianceonline.org",
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "email-1" });
    hoisted.sendSms.mockResolvedValue({ ok: true, providerMessageId: "sms-1" });
  });

  it("describes the current Manager actions without claiming a terminal rejection", async () => {
    const { sendJobCorrectionReadyNotification } = await import("./send-job-correction-ready");

    const result = await sendJobCorrectionReadyNotification({
      bookingId: "job-1",
      actorUserId: "employee-1",
      managerName: "Electro Manager",
      managerEmail: "manager@example.com",
      managerPhone: "+14075550124",
      managerReviewLink: "https://beta.relianceonline.org/vendor/jobs/job-1",
      vendorName: "Electro LLC",
      jobTitle: "Outlet Installation",
      employeeName: "Bradley Coopers",
    });

    expect(result.anySuccess).toBe(true);
    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.text).toContain(
      "submit it to Reliance Audit or request a correction for specific stages",
    );
    expect(email.html).toContain(
      "submit it to Reliance Audit or request a correction for specific stages",
    );
    expect(email.text).not.toContain("reject the completed work order");
    expect(email.html).not.toContain("reject the completed work order");
  });
});
