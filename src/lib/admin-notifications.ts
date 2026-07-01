import { prisma } from "@/server/db";
import { OWNER_ADMIN_EMAIL } from "@/lib/internal-identities";
import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import {
  getAdminNotificationEmailSummary,
  type AdminNotificationEmailSummaryContext,
} from "@/lib/ai/admin-notification-email-summary";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import type { AdminNotificationEmailSummaryResult } from "@/lib/ai/schemas";

export type AdminNotificationInput = {
  vendorId?: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | string | null;
  surfaceHref?: string;
  emailSubject?: string;
  emailEyebrow?: string;
  emailHeadline?: string;
  baseUrl?: string | null;
  actorUserId?: string | null;
};

export type AdminNotificationResult = {
  notification: any | null;
  emailSent: boolean;
  emailError?: string;
};

function normalizeMetadata(metadata: AdminNotificationInput["metadata"]): string | null {
  if (!metadata) return null;
  if (typeof metadata === "string") return metadata;
  return JSON.stringify(metadata);
}

function buildAbsoluteUrl(pathOrUrl: string, baseUrl?: string | null): string {
  const normalized = String(pathOrUrl || "/admin/notifications").trim() || "/admin/notifications";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const env = readNotificationEnv();
  const base = String(baseUrl || env.appBaseUrl || "").trim().replace(/\/+$/, "");
  if (!base) return normalized;
  return `${base}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
}

function metadataDetails(metadata: AdminNotificationInput["metadata"]) {
  if (!metadata || typeof metadata === "string") return [];

  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .slice(0, 6)
    .map(([label, value]) => ({
      label: label
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      value: String(value),
    }));
}

function buildAdminNotificationBodyHtml(
  message: string,
  aiSummary: AdminNotificationEmailSummaryResult | null
): string {
  const originalAlertHtml = `<p style="margin:0 0 12px;">${escapeRelianceEmailHtml(message)}</p><p style="margin:0;">This activity is waiting inside Reliance so you do not have to stay logged into the admin dashboard to know it happened.</p>`;

  if (!aiSummary) return originalAlertHtml;

  const riskColor =
    aiSummary.riskLevel === "high"
      ? "#fca5a5"
      : aiSummary.riskLevel === "medium"
        ? "#fde68a"
        : "#7dd3fc";

  return `${originalAlertHtml}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #29558f;border-radius:16px;background:#0a1d38;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;color:#8fb9ff;">AI Admin Summary</div>
          <p style="margin:0 0 12px;color:#eaf2ff;font-size:14px;line-height:1.6;">${escapeRelianceEmailHtml(aiSummary.summary)}</p>
          <div style="margin:0 0 8px;color:#bfd0ea;font-size:13px;line-height:1.55;"><strong style="color:${riskColor};">Risk level:</strong> ${escapeRelianceEmailHtml(aiSummary.riskLevel)}</div>
          <div style="margin:0 0 8px;color:#bfd0ea;font-size:13px;line-height:1.55;"><strong style="color:#ffffff;">Why it matters:</strong> ${escapeRelianceEmailHtml(aiSummary.whyItMatters)}</div>
          <div style="margin:0;color:#bfd0ea;font-size:13px;line-height:1.55;"><strong style="color:#ffffff;">Suggested next action:</strong> ${escapeRelianceEmailHtml(aiSummary.suggestedNextAction)}</div>
          <p style="margin:12px 0 0;color:#92a8c7;font-size:12px;line-height:1.5;">AI is summarizing this alert only. Reliance has not taken action until you review and decide.</p>
        </td>
      </tr>
    </table>`;
}

function buildAdminNotificationText(input: {
  title: string;
  message: string;
  adminUrl: string;
  aiSummary: AdminNotificationEmailSummaryResult | null;
}): string {
  const lines = [input.title, "", input.message];

  if (input.aiSummary) {
    lines.push(
      "",
      "AI admin summary:",
      input.aiSummary.summary,
      `Risk level: ${input.aiSummary.riskLevel}`,
      `Why it matters: ${input.aiSummary.whyItMatters}`,
      `Suggested next action: ${input.aiSummary.suggestedNextAction}`,
      "AI is summarizing this alert only. Reliance has not taken action until you review and decide."
    );
  }

  lines.push("", `Open admin review: ${input.adminUrl}`);
  return lines.join("\n");
}

async function tryBuildAdminNotificationAiSummary(input: {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  adminUrl: string;
  actorUserId?: string | null;
}): Promise<AdminNotificationEmailSummaryResult | null> {
  if (!isAiFeatureEnabled("support_inbox_triage")) return null;

  const context: AdminNotificationEmailSummaryContext = {
    notificationId: input.notificationId,
    type: input.type,
    title: input.title,
    message: input.message,
    details: input.details,
    adminUrl: input.adminUrl,
  };

  try {
    return await getAdminNotificationEmailSummary(context, input.actorUserId || "system");
  } catch (error) {
    console.warn("[admin-notifications] AI email summary unavailable:", error);
    return null;
  }
}

export async function createAdminNotificationWithEmail(
  input: AdminNotificationInput
): Promise<AdminNotificationResult> {
  const metadata = normalizeMetadata(input.metadata);
  const notification = await (prisma as any).adminNotification.create({
    data: {
      vendorId: input.vendorId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata,
      read: false,
    },
  });

  const adminUrl = buildAbsoluteUrl(input.surfaceHref || "/admin/notifications", input.baseUrl);
  const details = [
    { label: "Notification Type", value: input.type },
    { label: "Notification ID", value: String(notification.id) },
    ...metadataDetails(input.metadata),
  ];
  const aiSummary = await tryBuildAdminNotificationAiSummary({
    notificationId: String(notification.id),
    type: input.type,
    title: input.title,
    message: input.message,
    details,
    adminUrl,
    actorUserId: input.actorUserId,
  });
  const html = buildRelianceEmailHtml({
    eyebrow: input.emailEyebrow || "Admin Action Required",
    headline: input.emailHeadline || input.title,
    greeting: "Hi Cesar,",
    bodyHtml: buildAdminNotificationBodyHtml(input.message, aiSummary),
    details,
    cta: {
      label: "Open Admin Review",
      href: adminUrl,
    },
    fallbackHref: adminUrl,
    footerNote: "This admin alert was generated automatically by Reliance.",
    baseUrl: input.baseUrl,
  });

  const emailResult = await sendEmail({
    to: OWNER_ADMIN_EMAIL,
    subject: input.emailSubject || `Reliance admin action needed: ${input.title}`,
    html,
    text: buildAdminNotificationText({
      title: input.title,
      message: input.message,
      adminUrl,
      aiSummary,
    }),
  });

  await logNotificationAttempt(input.actorUserId || "system", String(notification.id), {
    kind: "admin_action_required",
    channel: "email",
    recipient: OWNER_ADMIN_EMAIL,
    success: emailResult.ok,
    providerMessageId: emailResult.providerMessageId,
    fallbackLink: adminUrl,
    errorMessage: emailResult.errorMessage,
  });

  return {
    notification,
    emailSent: emailResult.ok,
    emailError: emailResult.errorMessage,
  };
}

export async function tryEmailExistingAdminNotification(input: {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | string | null;
  surfaceHref?: string;
  baseUrl?: string | null;
  actorUserId?: string | null;
}): Promise<{ emailSent: boolean; emailError?: string }> {
  const adminUrl = buildAbsoluteUrl(input.surfaceHref || "/admin/notifications", input.baseUrl);
  const details = [
    { label: "Notification Type", value: input.type },
    { label: "Notification ID", value: input.notificationId },
    ...metadataDetails(input.metadata),
  ];
  const aiSummary = await tryBuildAdminNotificationAiSummary({
    notificationId: input.notificationId,
    type: input.type,
    title: input.title,
    message: input.message,
    details,
    adminUrl,
    actorUserId: input.actorUserId,
  });
  const html = buildRelianceEmailHtml({
    eyebrow: "Admin Action Required",
    headline: input.title,
    greeting: "Hi Cesar,",
    bodyHtml: buildAdminNotificationBodyHtml(input.message, aiSummary),
    details,
    cta: { label: "Open Admin Review", href: adminUrl },
    fallbackHref: adminUrl,
    footerNote: "This admin alert was generated automatically by Reliance.",
    baseUrl: input.baseUrl,
  });

  const emailResult = await sendEmail({
    to: OWNER_ADMIN_EMAIL,
    subject: `Reliance admin action needed: ${input.title}`,
    html,
    text: buildAdminNotificationText({
      title: input.title,
      message: input.message,
      adminUrl,
      aiSummary,
    }),
  });

  await logNotificationAttempt(input.actorUserId || "system", input.notificationId, {
    kind: "admin_action_required",
    channel: "email",
    recipient: OWNER_ADMIN_EMAIL,
    success: emailResult.ok,
    providerMessageId: emailResult.providerMessageId,
    fallbackLink: adminUrl,
    errorMessage: emailResult.errorMessage,
  });

  return {
    emailSent: emailResult.ok,
    emailError: emailResult.errorMessage,
  };
}
