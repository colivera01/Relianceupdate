import {
  readNotificationEnv,
  type NotificationEnvSnapshot,
} from "@/lib/env/notification-config";

export type EmployeeDecisionChannelAvailability = {
  email: boolean;
  sms: boolean;
};

function explicitlyEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function smsProviderReady(env: NotificationEnvSnapshot): boolean {
  if (env.smsProvider === "telnyx") {
    return Boolean(env.telnyxApiKey && env.telnyxFromNumber);
  }
  return Boolean(
    env.twilioAccountSid &&
      env.twilioAuthToken &&
      (env.twilioPhoneNumber || env.twilioMessagingServiceSid),
  );
}

export function getEmployeeDecisionChannelAvailability(input?: {
  env?: NotificationEnvSnapshot;
  employeeDecisionSmsEnabled?: string;
}): EmployeeDecisionChannelAvailability {
  const env = input?.env || readNotificationEnv();
  const smsReadyForEmployeeDecisions = explicitlyEnabled(
    input?.employeeDecisionSmsEnabled ?? process.env.EMPLOYEE_DECISION_SMS_ENABLED,
  );
  return {
    email: Boolean(env.emailEnabled && env.resendApiKey && env.emailFrom),
    sms: Boolean(
      smsReadyForEmployeeDecisions && env.smsEnabled && smsProviderReady(env),
    ),
  };
}

export function assertEmployeeDecisionChannelAvailable(
  channel: "email" | "sms",
  availability = getEmployeeDecisionChannelAvailability(),
) {
  if (!availability[channel]) {
    throw new Error("EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE");
  }
}

export function availableEmployeeDecisionContacts(input: {
  emailMasked: string | null;
  phoneMasked: string | null;
  availability?: EmployeeDecisionChannelAvailability;
}) {
  const availability = input.availability || getEmployeeDecisionChannelAvailability();
  return {
    email: availability.email ? input.emailMasked : null,
    sms: availability.sms ? input.phoneMasked : null,
  };
}
