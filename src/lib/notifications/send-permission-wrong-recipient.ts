import { prisma } from "@/server/db";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";

function normalizePhone(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : null;
}

export async function sendPermissionWrongRecipientNotification(input: {
  bookingId: string;
  consentRecordId: string;
  vendorId: string;
  vendorName: string;
  serviceOrderTitle: string;
}) {
  const managers = await prisma.vendorMembership.findMany({
    where: {
      vendorId: input.vendorId,
      role: { in: ["MANAGER", "manager"] },
      status: { in: ["ACTIVE", "active"] },
    },
    select: { user: { select: { name: true, email: true, phone: true } } },
  });
  const env = readNotificationEnv();
  const results: Array<{ channel: "email" | "sms"; success: boolean }> = [];

  for (const manager of managers) {
    const name = String(manager.user?.name || input.vendorName || "there").trim();
    const email = String(manager.user?.email || "").trim();
    const phone = normalizePhone(manager.user?.phone);
    const text = [
      `Hi ${name},`,
      "",
      `The recipient reported that the recording-permission request for ${input.serviceOrderTitle} was sent to the wrong person.`,
      "",
      "Recording remains locked. Correct the customer contact in Manage Jobs before sending a new request.",
      "The original request and report remain in the audit history.",
      "",
      "- Reliance Team",
    ].join("\n");

    if (env.emailEnabled && email) {
      const result = await sendEmail({
        to: email,
        subject: `Correct the recording-permission recipient: ${input.serviceOrderTitle}`,
        text,
        html: buildRelianceEmailHtml({
          eyebrow: "Recipient correction required",
          headline: "Recording request reported as misdirected",
          greeting: `Hi ${escapeRelianceEmailHtml(name)},`,
          bodyHtml: `<p>The recipient reported that the recording-permission request for <strong style="color:#fff;">${escapeRelianceEmailHtml(input.serviceOrderTitle)}</strong> was sent to the wrong person.</p>`,
          secondaryHtml: "<p>Recording remains locked. Open Manage Jobs and correct the customer contact before sending a new request. The original report remains in the audit history.</p>",
        }),
      });
      await logNotificationAttempt("permission-wrong-recipient", input.bookingId, {
        kind: "permission_wrong_recipient",
        channel: "email",
        recipient: email,
        success: result.ok,
        providerMessageId: result.providerMessageId,
        fallbackLink: "",
        errorMessage: result.errorMessage,
      });
      results.push({ channel: "email", success: result.ok });
    }

    if (env.smsEnabled && phone) {
      const result = await sendSms({
        to: phone,
        body: `Reliance: The recording request for ${input.serviceOrderTitle} was reported as sent to the wrong person. Correct the customer contact before sending a new request.`,
      });
      await logNotificationAttempt("permission-wrong-recipient", input.bookingId, {
        kind: "permission_wrong_recipient",
        channel: "sms",
        recipient: phone,
        success: result.ok,
        providerMessageId: result.providerMessageId,
        fallbackLink: "",
        errorMessage: result.errorMessage,
        errorCode: result.errorCode,
      });
      results.push({ channel: "sms", success: result.ok });
    }
  }

  return results;
}
