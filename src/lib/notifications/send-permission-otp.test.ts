import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  readNotificationEnv: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: hoisted.sendEmail,
}));

vi.mock("@/lib/sms/twilio", () => ({
  sendSms: hoisted.sendSms,
}));

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: hoisted.readNotificationEnv,
}));

describe("sendPermissionOtp", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.sendEmail.mockReset();
    hoisted.sendSms.mockReset();
    hoisted.readNotificationEnv.mockReset();
    hoisted.readNotificationEnv.mockReturnValue({
      emailEnabled: true,
      smsEnabled: true,
      appBaseUrl: "https://beta.relianceonline.org",
    });
    hoisted.sendEmail.mockResolvedValue({
      ok: true,
      providerMessageId: "email-otp-1",
    });
  });

  it("uses the Reliance email template for recording-permission codes", async () => {
    const { sendPermissionOtp } = await import("./send-permission-otp");

    const result = await sendPermissionOtp({
      channel: "email",
      destination: "customer@example.com",
      code: "079978",
      vendorName: "Electro LLC",
      serviceName: "Outlet Installation",
    });

    expect(result).toEqual({
      ok: true,
      providerMessageId: "email-otp-1",
      errorMessage: undefined,
    });
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.subject).toBe("Your Reliance recording-permission code");
    expect(email.html).toContain("reliance-email-logo.png");
    expect(email.html).toContain("Recording permission code");
    expect(email.html).toContain("Review the recording request");
    expect(email.html).toContain("Electro LLC");
    expect(email.html).toContain("079978");
    expect(email.html).toContain("Outlet Installation");
    expect(email.html).toContain("This code expires in 10 minutes.");
    expect(email.html).toContain("never ask you to send this code to a service provider");
    expect(email.text).toContain("Enter this secure code on the Reliance permission page:");
    expect(email.text).toContain("079978");
    expect(email.text).toContain("Service: Outlet Installation");
    expect(hoisted.sendSms).not.toHaveBeenCalled();
  });

  it("escapes untrusted service context in the HTML email", async () => {
    const { sendPermissionOtp } = await import("./send-permission-otp");

    await sendPermissionOtp({
      channel: "email",
      destination: "customer@example.com",
      code: "123456",
      vendorName: "<script>vendor</script>",
      serviceName: "Outlet <Repair>",
    });

    const email = hoisted.sendEmail.mock.calls[0][0];
    expect(email.html).not.toContain("<script>vendor</script>");
    expect(email.html).toContain("&lt;script&gt;vendor&lt;/script&gt;");
    expect(email.html).toContain("Outlet &lt;Repair&gt;");
  });
});
