import { prisma } from "@/server/db";
import { OWNER_ADMIN_EMAIL } from "@/lib/internal-identities";
import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

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
  const html = buildRelianceEmailHtml({
    eyebrow: input.emailEyebrow || "Admin Action Required",
    headline: input.emailHeadline || input.title,
    greeting: "Hi Cesar,",
    bodyHtml: `<p style="margin:0 0 12px;">${escapeRelianceEmailHtml(input.message)}</p><p style="margin:0;">This activity is waiting inside Reliance so you do not have to stay logged into the admin dashboard to know it happened.</p>`,
    details: [
      { label: "Notification Type", value: input.type },
      { label: "Notification ID", value: String(notification.id) },
      ...metadataDetails(input.metadata),
    ],
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
    text: `${input.title}\n\n${input.message}\n\nOpen admin review: ${adminUrl}`,
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
  const html = buildRelianceEmailHtml({
    eyebrow: "Admin Action Required",
    headline: input.title,
    greeting: "Hi Cesar,",
    bodyHtml: `<p style="margin:0 0 12px;">${escapeRelianceEmailHtml(input.message)}</p><p style="margin:0;">This activity is waiting inside Reliance so you do not have to stay logged into the admin dashboard to know it happened.</p>`,
    details: [
      { label: "Notification Type", value: input.type },
      { label: "Notification ID", value: input.notificationId },
      ...metadataDetails(input.metadata),
    ],
    cta: { label: "Open Admin Review", href: adminUrl },
    fallbackHref: adminUrl,
    footerNote: "This admin alert was generated automatically by Reliance.",
    baseUrl: input.baseUrl,
  });

  const emailResult = await sendEmail({
    to: OWNER_ADMIN_EMAIL,
    subject: `Reliance admin action needed: ${input.title}`,
    html,
    text: `${input.title}\n\n${input.message}\n\nOpen admin review: ${adminUrl}`,
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
