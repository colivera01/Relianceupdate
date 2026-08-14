import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";

type Recipient = { name?: string | null; email?: string | null; phone?: string | null; role: "CUSTOMER" | "EMPLOYEE" };

function normalizedPhone(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : null;
}

export async function sendServiceOrderCanceledNotifications(input: {
  bookingId: string;
  actorUserId: string;
  vendorName: string;
  serviceOrderTitle: string;
  reason: string;
  recipients: Recipient[];
}) {
  const env = readNotificationEnv();
  const results: Array<Record<string, unknown>> = [];
  for (const recipient of input.recipients) {
    const name = String(recipient.name || "").trim();
    const email = String(recipient.email || "").trim();
    const phone = normalizedPhone(recipient.phone);
    const text = [
      name ? `Hi ${name},` : "Hi,",
      "",
      `${input.vendorName} canceled the Service Order for ${input.serviceOrderTitle}.`,
      `Reason: ${input.reason}`,
      "",
      "Recording and uploads are closed for this Service Order. A replacement requires a new Service Order.",
      "",
      "- Reliance Team",
    ].join("\n");
    if (env.emailEnabled && email) {
      const result = await sendEmail({
        to: email,
        subject: `Service Order canceled: ${input.serviceOrderTitle}`,
        text,
        html: buildRelianceEmailHtml({
          eyebrow: "Service Order canceled",
          headline: input.serviceOrderTitle,
          greeting: name ? `Hi ${escapeRelianceEmailHtml(name)},` : "Hi,",
          bodyHtml: `<p><strong style="color:#fff;">${escapeRelianceEmailHtml(input.vendorName)}</strong> canceled this Service Order.</p>`,
          details: [{ label: "Reason", value: input.reason }],
          secondaryHtml: "<p>Recording and uploads are closed. If service is still needed, the business must create a new Service Order.</p>",
        }),
      });
      await logNotificationAttempt(input.actorUserId, input.bookingId, {
        kind: "service_order_canceled",
        channel: "email",
        recipient: email,
        success: result.ok,
        providerMessageId: result.providerMessageId,
        fallbackLink: "",
        errorMessage: result.errorMessage,
      });
      results.push({ role: recipient.role, channel: "email", success: result.ok });
    }
    if (env.smsEnabled && phone) {
      const result = await sendSms({
        to: phone,
        body: `Reliance: ${input.vendorName} canceled the Service Order for ${input.serviceOrderTitle}. Recording and uploads are closed.`,
      });
      await logNotificationAttempt(input.actorUserId, input.bookingId, {
        kind: "service_order_canceled",
        channel: "sms",
        recipient: phone,
        success: result.ok,
        providerMessageId: result.providerMessageId,
        fallbackLink: "",
        errorMessage: result.errorMessage,
        errorCode: result.errorCode,
      });
      results.push({ role: recipient.role, channel: "sms", success: result.ok });
    }
  }
  return results;
}
