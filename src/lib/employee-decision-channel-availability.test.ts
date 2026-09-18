import { describe, expect, it } from "vitest";

import type { NotificationEnvSnapshot } from "@/lib/env/notification-config";
import {
  assertEmployeeDecisionChannelAvailable,
  availableEmployeeDecisionContacts,
  getEmployeeDecisionChannelAvailability,
} from "@/lib/employee-decision-channel-availability";

function notificationEnv(
  overrides: Partial<NotificationEnvSnapshot> = {},
): NotificationEnvSnapshot {
  return {
    resendApiKey: "resend-key",
    emailFrom: "Reliance <noreply@example.com>",
    emailReplyTo: "",
    smsProvider: "telnyx",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    twilioMessagingServiceSid: "",
    telnyxApiKey: "telnyx-key",
    telnyxFromNumber: "+13215550100",
    telnyxMessagingProfileId: "",
    appBaseUrl: "https://beta.example.com",
    emailEnabled: true,
    smsEnabled: true,
    ...overrides,
  };
}

describe("Employee decision verification channel availability", () => {
  it("offers configured email while SMS remains dormant by default", () => {
    expect(getEmployeeDecisionChannelAvailability({
      env: notificationEnv(),
      employeeDecisionSmsEnabled: undefined,
    })).toEqual({ email: true, sms: false });
  });

  it("offers SMS only when the Employee OTP channel is explicitly enabled and provider-ready", () => {
    expect(getEmployeeDecisionChannelAvailability({
      env: notificationEnv(),
      employeeDecisionSmsEnabled: "true",
    })).toEqual({ email: true, sms: true });

    expect(getEmployeeDecisionChannelAvailability({
      env: notificationEnv({ telnyxApiKey: "" }),
      employeeDecisionSmsEnabled: "true",
    }).sms).toBe(false);
  });

  it("supports a ready Twilio OTP configuration without weakening the explicit activation", () => {
    const env = notificationEnv({
      smsProvider: "twilio",
      telnyxApiKey: "",
      telnyxFromNumber: "",
      twilioAccountSid: "account",
      twilioAuthToken: "token",
      twilioMessagingServiceSid: "service",
    });
    expect(getEmployeeDecisionChannelAvailability({
      env,
      employeeDecisionSmsEnabled: "true",
    }).sms).toBe(true);
  });

  it("removes unavailable contacts and rejects direct selection of a hidden channel", () => {
    const availability = { email: true, sms: false };
    expect(availableEmployeeDecisionContacts({
      emailMasked: "e***@example.com",
      phoneMasked: "***0123",
      availability,
    })).toEqual({ email: "e***@example.com", sms: null });
    expect(() => assertEmployeeDecisionChannelAvailable("sms", availability)).toThrow(
      "EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE",
    );
  });
});
