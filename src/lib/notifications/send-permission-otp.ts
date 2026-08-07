import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";
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
    const subject = "Your Reliance recording-permission code";
    const html = buildRelianceEmailHtml({
      eyebrow: "Recording permission code",
      headline: "Review the recording request",
      bodyHtml: `
        <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(input.vendorName)}</strong> sent a recording-permission request for your service.</p>
        <p style="margin:0 0 10px;">Enter this secure code on the Reliance permission page:</p>
        <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:0.18em;color:#ffffff;">${escapeRelianceEmailHtml(input.code)}</p>
      `,
      details: [{ label: "Service", value: input.serviceName }],
      secondaryHtml: '<p style="margin:0;">This code expires in 10 minutes.</p>',
      footerNote:
        "Reliance will never ask you to send this code to a service provider. If you did not request this code, you can ignore this message.",
    });
    const text = [
      `${input.vendorName} sent a recording-permission request for your service.`,
      "",
      "Enter this secure code on the Reliance permission page:",
      input.code,
      "",
      `Service: ${input.serviceName}`,
      "This code expires in 10 minutes.",
      "Reliance will never ask you to send this code to a service provider.",
      "If you did not request this code, you can ignore this message.",
    ].join("\n");
    const result = await sendEmail({
      to: input.destination,
      subject,
      html,
      text,
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
