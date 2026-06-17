import type { AuthSessionClaims } from "@/lib/auth-session";
import type { AuthLoginUserPayload } from "@/lib/auth-login-response";
import { sendEmail } from "@/lib/email/resend";
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
  claims: Pick<AuthSessionClaims, "issuedAt">,
  timeoutMinutes: unknown,
  nowMs = Date.now()
): boolean {
  const expiresAtMs = calculateVendorSessionExpiryMs(claims.issuedAt, timeoutMinutes);
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
  if (!claims?.userId || !hasVendorAccessInSession(claims)) {
    return {
      applies: false,
      expired: false,
      timeoutMinutes: DEFAULT_VENDOR_TIMEOUT_MINUTES,
      issuedAtMs: null,
      expiresAtMs: null,
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
      vendorIds: [],
    };
  }

  // If one sign-in controls multiple vendor views, apply the strictest timeout.
  const timeoutMinutes = Math.min(...rows.map((row) => row.sessionTimeout));
  const expiresAtMs = calculateVendorSessionExpiryMs(claims.issuedAt, timeoutMinutes);
  return {
    applies: true,
    expired: expiresAtMs != null && expiresAtMs <= nowMs,
    timeoutMinutes,
    issuedAtMs: claims.issuedAt ? claims.issuedAt * 1000 : null,
    expiresAtMs,
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

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">New Reliance vendor sign-in</h2>
      <p>Hello ${escapeHtml(params.name)},</p>
      <p>Reliance detected a sign-in to vendor tools for:</p>
      <ul>${params.vendorNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
      <div style="padding:14px 16px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff">
        <p style="margin:0"><strong>Device:</strong> ${escapeHtml(params.device)}</p>
        <p style="margin:4px 0 0"><strong>Approximate IP:</strong> ${escapeHtml(params.ip)}</p>
        <p style="margin:4px 0 0"><strong>Time:</strong> ${escapeHtml(params.occurredAt.toLocaleString("en-US", { timeZoneName: "short" }))}</p>
      </div>
      <p>If this was you, no action is needed. If this was not you, change your password and review your Security Settings.</p>
      <p><a href="${escapeHtml(params.dashboardUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">Open Security Settings</a></p>
    </div>
  `;

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
