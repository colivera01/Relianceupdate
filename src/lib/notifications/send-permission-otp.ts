import { sendEmail } from "@/lib/email/resend";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendSms } from "@/lib/sms/twilio";

export async function sendPermissionOtp(input: {
  channel: "email" | "sms";
  destination: string;
  code: string;
  vendorName: string;
  serviceName: string;
}) {
  const env = readNotificationEnv();
  if (input.channel === "email") {
    if (!env.emailEnabled)
      return {
        ok: false,
        errorCode: "EMAIL_DISABLED",
        errorMessage: "email_disabled",
      };
    const result = await sendEmail({
      to: input.destination,
      subject: "Your Reliance recording-permission code",
      text: [
        `Use this code to review the recording request from ${input.vendorName}:`,
        "",
        input.code,
        "",
        `Service: ${input.serviceName}`,
        "This code expires in 10 minutes. Reliance will never ask you to send this code to a service provider.",
      ].join("\n"),
    });
    return {
      ok: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    };
  }
  if (!env.smsEnabled)
    return {
      ok: false,
      errorCode: "SMS_DISABLED",
      errorMessage: "sms_disabled",
    };
  const result = await sendSms({
    to: input.destination,
    body: `Reliance code: ${input.code}. Use it to review ${input.vendorName}'s recording request for ${input.serviceName}. Expires in 10 minutes. Do not share it.`,
  });
  return {
    ok: result.ok,
    providerMessageId: result.providerMessageId,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
