import type { AuthSessionClaims } from "@/lib/auth-session";
import type { AuthLoginUserPayload } from "@/lib/auth-login-response";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml } from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { prisma } from "@/server/db";

const DEFAULT_VENDOR_TIMEOUT_MINUTES = 30;
const MIN_VENDOR_TIMEOUT_MINUTES = 5;
const MAX_VENDOR_TIMEOUT_MINUTES = 24 * 60;

type VendorSecurityRow = {
  vendorId: string;
  businessName: string;
  loginNotifications: boolean;
  sessionTimeout: number;
};

export type VendorSessionTimeoutStatus = {
  applies: boolean;
  expired: boolean;
  timeoutMinutes: number;
  issuedAtMs: number | null;
  expiresAtMs: number | null;
  idleExpiresAtMs: number | null;
  absoluteExpiresAtMs: number | null;
  warningAtMs: number | null;
  requiresSessionRefresh: boolean;
  vendorIds: string[];
};

export function hasVendorAccessInSession(
  value: Pick<AuthSessionClaims, "userType" | "availableProfiles"> | Pick<AuthLoginUserPayload, "userType" | "availableProfiles"> | null | undefined
): boolean {
  if (!value) return false;
  return (
    value.userType === "vendor" ||
    value.userType === "both" ||
    value.availableProfiles?.includes("vendor")
  );
}

export function normalizeVendorSessionTimeoutMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_VENDOR_TIMEOUT_MINUTES;
  const wholeMinutes = Math.round(parsed);
  return Math.min(MAX_VENDOR_TIMEOUT_MINUTES, Math.max(MIN_VENDOR_TIMEOUT_MINUTES, wholeMinutes));
}

export function calculateVendorSessionExpiryMs(
  issuedAtSeconds: unknown,
  timeoutMinutes: unknown
): number | null {
  const issuedAt = Number(issuedAtSeconds);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null;
  return issuedAt * 1000 + normalizeVendorSessionTimeoutMinutes(timeoutMinutes) * 60 * 1000;
}

export function isVendorSessionExpired(
  claims: Pick<AuthSessionClaims, "issuedAt" | "lastActivityAt">,
  timeoutMinutes: unknown,
  nowMs = Date.now()
): boolean {
  const expiresAtMs = calculateVendorSessionExpiryMs(claims.lastActivityAt || claims.issuedAt, timeoutMinutes);
  return expiresAtMs != null && expiresAtMs <= nowMs;
}

async function readVendorSecurityRowsForUser(userId: string): Promise<VendorSecurityRow[]> {
  const memberships = await (prisma as any).vendorMembership.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: {
      vendorId: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
          name: true,
          loginNotifications: true,
          sessionTimeout: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const rows: VendorSecurityRow[] = [];
  for (const membership of memberships || []) {
    const vendorId = String(membership?.vendor?.id || membership?.vendorId || "").trim();
    if (!vendorId || seen.has(vendorId)) continue;
    seen.add(vendorId);
    rows.push({
      vendorId,
      businessName:
        String(membership?.vendor?.businessName || membership?.vendor?.name || "Vendor account").trim() ||
        "Vendor account",
      loginNotifications: membership?.vendor?.loginNotifications !== false,
      sessionTimeout: normalizeVendorSessionTimeoutMinutes(membership?.vendor?.sessionTimeout),
    });
  }
  return rows;
}

export async function getVendorSessionTimeoutStatus(
  claims: AuthSessionClaims | null | undefined,
  nowMs = Date.now()
): Promise<VendorSessionTimeoutStatus> {
  if (!claims?.userId) {
    return {
      applies: false,
      expired: false,
      timeoutMinutes: DEFAULT_VENDOR_TIMEOUT_MINUTES,
      issuedAtMs: null,
      expiresAtMs: null,
      idleExpiresAtMs: null,
      absoluteExpiresAtMs: null,
      warningAtMs: null,
      requiresSessionRefresh: false,
      vendorIds: [],
    };
  }

  const rows = await readVendorSecurityRowsForUser(claims.userId);
  if (!rows.length) {
    return {
      applies: false,
      expired: false,
      timeoutMinutes: DEFAULT_VENDOR_TIMEOUT_MINUTES,
      issuedAtMs: claims.issuedAt ? claims.issuedAt * 1000 : null,
      expiresAtMs: null,
      idleExpiresAtMs: null,
      absoluteExpiresAtMs: claims.expiresAt ? claims.expiresAt * 1000 : null,
      warningAtMs: null,
      requiresSessionRefresh: claims.version === 1 || !claims.lastActivityAt,
      vendorIds: [],
    };
  }

  // If one sign-in controls multiple vendor views, apply the strictest timeout.
  const timeoutMinutes = Math.min(...rows.map((row) => row.sessionTimeout));
  const idleExpiresAtMs = calculateVendorSessionExpiryMs(
    claims.lastActivityAt || claims.issuedAt,
    timeoutMinutes
  );
  const absoluteExpiresAtMs = claims.expiresAt ? claims.expiresAt * 1000 : null;
  const expiresAtMs =
    idleExpiresAtMs && absoluteExpiresAtMs
      ? Math.min(idleExpiresAtMs, absoluteExpiresAtMs)
      : idleExpiresAtMs || absoluteExpiresAtMs;
  const warningWindowMs = Math.min(5 * 60_000, Math.max(60_000, timeoutMinutes * 60_000 * 0.2));
  return {
    applies: true,
    expired: expiresAtMs != null && expiresAtMs <= nowMs,
    timeoutMinutes,
    issuedAtMs: claims.issuedAt ? claims.issuedAt * 1000 : null,
    expiresAtMs,
    idleExpiresAtMs,
    absoluteExpiresAtMs,
    warningAtMs: expiresAtMs ? expiresAtMs - warningWindowMs : null,
    requiresSessionRefresh: claims.version === 1 || !claims.lastActivityAt,
    vendorIds: rows.map((row) => row.vendorId),
  };
}

function getClientIp(request: Request | undefined): string {
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function getClientDevice(request: Request | undefined): string {
  const userAgent = request?.headers.get("user-agent") || "";
  if (!userAgent) return "Unknown browser";
  if (/edg/i.test(userAgent)) return "Microsoft Edge";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return userAgent.slice(0, 90);
}

function buildVendorLoginAlertEmail(params: {
  name: string;
  vendorNames: string[];
  device: string;
  ip: string;
  occurredAt: Date;
  dashboardUrl: string;
  baseUrl: string;
}) {
  const vendorList = params.vendorNames.map((name) => `- ${name}`).join("\n");
  const text = `Hello ${params.name},

Reliance detected a vendor dashboard sign-in.

Vendor account:
${vendorList}

Device: ${params.device}
Approximate IP: ${params.ip}
Time: ${params.occurredAt.toLocaleString("en-US", { timeZoneName: "short" })}

If this was you, no action is needed. If this was not you, change your password and review your Security Settings:
${params.dashboardUrl}`;

  const html = buildRelianceEmailHtml({
    eyebrow: "Security alert",
    headline: "New Reliance vendor sign-in",
    greeting: `Hello ${params.name},`,
    bodyHtml: '<p style="margin:0;">Reliance detected a sign-in to vendor tools.</p>',
    details: [
      { label: "Vendor account", value: params.vendorNames.join(", ") },
      { label: "Device", value: params.device },
      { label: "Approximate IP", value: params.ip },
      { label: "Time", value: params.occurredAt.toLocaleString("en-US", { timeZoneName: "short" }) },
    ],
    cta: { label: "Open Security Settings", href: params.dashboardUrl },
    fallbackHref: params.dashboardUrl,
    footerNote: "If this was you, no action is needed. If this was not you, change your password and review your Security Settings.",
    baseUrl: params.baseUrl,
  });

  return { text, html };
}

export async function sendVendorLoginAlert(params: {
  user: AuthLoginUserPayload;
  request?: Request;
}): Promise<void> {
  if (!hasVendorAccessInSession(params.user)) return;
  const recipient = String(params.user.email || "").trim();
  if (!recipient || !recipient.includes("@")) return;

  const rows = await readVendorSecurityRowsForUser(params.user.id).catch((error) => {
    console.error("[vendor-security] login alert vendor lookup failed", error);
    return [] as VendorSecurityRow[];
  });
  const alertableRows = rows.filter((row) => row.loginNotifications);
  if (!alertableRows.length) return;

  const origin =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    params.request?.headers.get("origin") ||
    "http://localhost:3000";
  const dashboardUrl = `${String(origin).replace(/\/$/, "")}/vendor/profile`;
  const occurredAt = new Date();
  const email = buildVendorLoginAlertEmail({
    name: params.user.name || params.user.email,
    vendorNames: alertableRows.map((row) => row.businessName),
    device: getClientDevice(params.request),
    ip: getClientIp(params.request),
    occurredAt,
    dashboardUrl,
    baseUrl: origin,
  });

  const result = await sendEmail({
    to: recipient,
    subject: "New Reliance vendor sign-in",
    html: email.html,
    text: email.text,
  });

  await logNotificationAttempt(params.user.id, alertableRows[0]?.vendorId || params.user.id, {
    channel: "email",
    recipient,
    success: result.ok,
    providerMessageId: result.providerMessageId,
    fallbackLink: dashboardUrl,
    errorMessage: result.errorMessage,
    kind: "vendor_login_alert",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
