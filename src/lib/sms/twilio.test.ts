import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const createMessage = vi.fn();
  const twilioFactory = vi.fn(() => ({
    messages: {
      create: createMessage,
    },
  }));
  const readNotificationEnv = vi.fn();

  return {
    createMessage,
    twilioFactory,
    readNotificationEnv,
  };
});

vi.mock("twilio", () => ({
  default: hoisted.twilioFactory,
}));

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: hoisted.readNotificationEnv,
}));

function mockNotificationEnv(overrides: Record<string, unknown> = {}) {
  hoisted.readNotificationEnv.mockReturnValue({
    resendApiKey: "",
    emailFrom: "",
    emailReplyTo: "",
    smsProvider: "twilio",
    twilioAccountSid: "AC_test",
    twilioAuthToken: "auth_token",
    twilioPhoneNumber: "+14075550100",
    twilioMessagingServiceSid: "",
    telnyxApiKey: "",
    telnyxFromNumber: "",
    telnyxMessagingProfileId: "",
    appBaseUrl: "http://localhost:3000",
    emailEnabled: true,
    smsEnabled: true,
    ...overrides,
  });
}

describe("sendSms", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    hoisted.createMessage.mockReset();
    hoisted.twilioFactory.mockClear();
    hoisted.readNotificationEnv.mockReset();
    vi.unstubAllGlobals();
    mockNotificationEnv();
  });

  it("uses a Twilio Messaging Service when configured for A2P 10DLC sending", async () => {
    mockNotificationEnv({
      twilioPhoneNumber: "",
      twilioMessagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    hoisted.createMessage.mockResolvedValue({ sid: "SM_message_service" });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result).toEqual({ ok: true, provider: "twilio", providerMessageId: "SM_message_service" });
    expect(hoisted.twilioFactory).toHaveBeenCalledWith("AC_test", "auth_token");
    expect(hoisted.createMessage).toHaveBeenCalledWith({
      to: "+14079148888",
      messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      body: "Reliance test",
    });
  });

  it("falls back to a direct Twilio phone sender when no Messaging Service is configured", async () => {
    hoisted.createMessage.mockResolvedValue({ sid: "SM_direct_sender" });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result).toEqual({ ok: true, provider: "twilio", providerMessageId: "SM_direct_sender" });
    expect(hoisted.createMessage).toHaveBeenCalledWith({
      to: "+14079148888",
      from: "+14075550100",
      body: "Reliance test",
    });
  });

  it("does not attempt SMS when neither a Messaging Service nor phone sender is configured", async () => {
    mockNotificationEnv({
      twilioPhoneNumber: "",
      twilioMessagingServiceSid: "",
    });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result).toEqual({ ok: false, provider: "twilio", errorMessage: "missing_twilio_config" });
    expect(hoisted.twilioFactory).not.toHaveBeenCalled();
    expect(hoisted.createMessage).not.toHaveBeenCalled();
  });

  it("maps Twilio sender verification blocks to a clear setup message", async () => {
    hoisted.createMessage.mockRejectedValue({ code: 30032 });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("30032");
    expect(result.senderVerificationRestriction).toBe(true);
    expect(result.errorMessage).toContain("approved A2P 10DLC Messaging Service");
  });

  it("sends through Telnyx when SMS_PROVIDER is telnyx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "telnyx-message-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mockNotificationEnv({
      smsProvider: "telnyx",
      telnyxApiKey: "KEY_test",
      telnyxFromNumber: "+13213951708",
    });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result).toEqual({ ok: true, provider: "telnyx", providerMessageId: "telnyx-message-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer KEY_test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          from: "+13213951708",
          to: "+14079148888",
          text: "Reliance test",
        }),
      })
    );
    expect(hoisted.twilioFactory).not.toHaveBeenCalled();
  });

  it("does not attempt Telnyx SMS when Telnyx credentials are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockNotificationEnv({
      smsProvider: "telnyx",
      telnyxApiKey: "",
      telnyxFromNumber: "",
    });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+14079148888", body: "Reliance test" });

    expect(result).toEqual({ ok: false, provider: "telnyx", errorMessage: "missing_telnyx_config" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hoisted.twilioFactory).not.toHaveBeenCalled();
  });

  it("maps Telnyx API failures to a clear setup message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          errors: [{ code: "10015", detail: "The 'to' number is invalid." }],
        }),
      })
    );
    mockNotificationEnv({
      smsProvider: "telnyx",
      telnyxApiKey: "KEY_test",
      telnyxFromNumber: "+13213951708",
    });

    const { sendSms } = await import("./twilio");
    const result = await sendSms({ to: "+1407", body: "Reliance test" });

    expect(result).toEqual({
      ok: false,
      provider: "telnyx",
      errorMessage: "The 'to' number is invalid.",
      errorCode: "10015",
    });
  });
});
