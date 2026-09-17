import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";
import { readNotificationEnv } from "@/lib/env/notification-config";
import type { EmployeeDecisionPurpose } from "@/lib/employee-decision-verification";
import { sendSms } from "@/lib/sms/twilio";

export async function sendEmployeeDecisionOtp(input: {
  channel: "email" | "sms";
  destination: string;
  code: string;
  employeeName: string;
  vendorName: string;
  serviceName: string | null;
  purpose: EmployeeDecisionPurpose;
}) {
  const env = readNotificationEnv();
  const isRecording = input.purpose === "EMPLOYEE_RECORDING_PARTICIPATION";
  const action = isRecording
    ? `recording participation for ${input.serviceName || "this service"}`
    : `Public Service Video participation for ${input.vendorName}`;
  if (input.channel === "email") {
    if (!env.emailEnabled) {
      return { ok: false, errorCode: "EMAIL_DISABLED", errorMessage: "email_disabled" };
    }
    const result = await sendEmail({
      to: input.destination,
      subject: "Your Reliance Employee verification code",
      html: buildRelianceEmailHtml({
        eyebrow: "Employee identity verification",
        headline: "Verify it is you",
        bodyHtml: `<p style="margin:0 0 12px;">Use this code to review ${escapeRelianceEmailHtml(action)}:</p><p style="margin:0;font-size:30px;font-weight:800;letter-spacing:0.18em;color:#ffffff;">${escapeRelianceEmailHtml(input.code)}</p>`,
        details: [
          { label: "Employee", value: input.employeeName },
          { label: "Business", value: input.vendorName },
        ],
        secondaryHtml: "<p style=\"margin:0;\">This code expires in 10 minutes and can be used only for this decision.</p>",
        footerNote: "Reliance will never ask you to share this code with a manager, customer, or administrator.",
      }),
      text: [
        `Reliance Employee verification code: ${input.code}`,
        `Use it to review ${action}.`,
        "This code expires in 10 minutes and can be used only for this decision.",
        "Do not share it.",
      ].join("\n"),
    });
    return {
      ok: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    };
  }
  if (!env.smsEnabled) {
    return { ok: false, errorCode: "SMS_DISABLED", errorMessage: "sms_disabled" };
  }
  const result = await sendSms({
    to: input.destination,
    body: `Reliance Employee code: ${input.code}. Use it for ${action}. Expires in 10 minutes. Do not share it.`,
  });
  return {
    ok: result.ok,
    providerMessageId: result.providerMessageId,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
