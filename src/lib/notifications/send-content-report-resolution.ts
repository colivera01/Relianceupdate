import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, getPublicEmailBaseUrl } from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

export async function sendContentReportResolution(input: {
  reportId: string;
  caseReference: string;
  recipient: string;
  actionTaken: boolean;
  baseUrl?: string | null;
}) {
  const baseUrl = getPublicEmailBaseUrl(input.baseUrl);
  const statusUrl = `${baseUrl}/my-bookings`;
  const headline = "Your Service Video report has been reviewed";
  const message = input.actionTaken
    ? "Reliance took action regarding the reported Service Video. Internal enforcement details remain private."
    : "Reliance reviewed the concern. Thank you for helping us keep Service Videos trustworthy.";
  const result = await sendEmail({
    to: input.recipient,
    subject: `${headline} - ${input.caseReference}`,
    text: `${headline}\n\nReference: ${input.caseReference}\n\n${message}\n\nOpen Reliance: ${statusUrl}`,
    html: buildRelianceEmailHtml({
      eyebrow: "Report Update",
      headline,
      greeting: "Hello,",
      bodyHtml: `<p style="margin:0 0 12px;">Reference: <strong>${input.caseReference}</strong></p><p style="margin:0;">${message}</p>`,
      cta: { label: "Open Reliance", href: statusUrl },
      fallbackHref: statusUrl,
      footerNote: "This message contains a safe case update and no confidential enforcement detail.",
      baseUrl,
    }),
  });
  await logNotificationAttempt("system", input.reportId, {
    kind: "content_report_resolution",
    channel: "email",
    recipient: input.recipient,
    success: result.ok,
    providerMessageId: result.providerMessageId,
    fallbackLink: statusUrl,
    errorMessage: result.errorMessage,
  });
  return result;
}
