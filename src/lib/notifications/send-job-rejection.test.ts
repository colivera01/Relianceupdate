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

describe("sendJobRejectionNotification", () => {
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

  it("uses correction guidance that remains accurate for one or multiple requested stages", async () => {
    const { sendJobRejectionNotification } = await import("./send-job-rejection");

    const result = await sendJobRejectionNotification({
      bookingId: "job-1",
      actorUserId: "manager-1",
      employeeName: "Bradley Coopers",
      employeeEmail: "employee@example.com",
      employeePhone: "+14075550124",
      employeeJobLink: "https://beta.relianceonline.org/employee/jobs?jobId=job-1",
      vendorName: "Electro LLC",
      jobTitle: "Outlet Installation",
      rejectionReason: "Retake the selected stages. Stages: INTRO, IN_PROGRESS, COMPLETED.",
    });

    expect(result.anySuccess).toBe(true);
    const email = hoisted.sendEmail.mock.calls[0][0];
    const sms = hoisted.sendSms.mock.calls[0][0];
    expect(email.text).toContain("replace every requested video stage");
    expect(email.html).toContain("Replace every requested video stage");
    expect(sms.body).toContain("replace every requested video stage");
    expect(email.text).not.toContain("the video stage that needs correction");
    expect(email.html).not.toContain("the stage video that needs correction");
    expect(sms.body).not.toContain("the needed video stage");
  });
});
