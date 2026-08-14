import crypto from "crypto";
import { prisma } from "@/server/db";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { normalizeAccountStatus } from "@/lib/account-status-shared";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const TOKEN_VERSION = 1;

export type EmployeeCaptureClaims = {
  vendorId: string;
  bookingId: string;
  membershipId: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

export type EmployeeCaptureAccess = {
  vendorId: string;
  bookingId: string;
  membershipId: string;
  userId: string;
  role: string;
  status: string;
  employeeName: string | null;
  token: EmployeeCaptureClaims;
};

function resolveSecret(): string {
  const configured = String(process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET || process.env.AUTH_SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "reliance-dev-employee-capture-token-secret";
  throw new Error("EMPLOYEE_CAPTURE_TOKEN_SECRET or AUTH_SESSION_SECRET is required");
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function sign(payload: string): string {
  return toBase64Url(crypto.createHmac("sha256", resolveSecret()).update(payload).digest());
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createEmployeeCaptureToken(input: {
  vendorId: string;
  bookingId: string;
  membershipId: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: EmployeeCaptureClaims = {
    vendorId: String(input.vendorId || "").trim(),
    bookingId: String(input.bookingId || "").trim(),
    membershipId: String(input.membershipId || "").trim(),
    issuedAt: now,
    expiresAt: now + Math.max(60, input.ttlSeconds || TOKEN_TTL_SECONDS),
    version: TOKEN_VERSION,
  };
  if (!claims.vendorId || !claims.bookingId || !claims.membershipId) {
    throw new Error("Missing employee capture token fields");
  }
  const payload = toBase64Url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function readEmployeeCaptureToken(request: Request): string | null {
  const header = request.headers.get("x-employee-capture-token");
  if (header?.trim()) return header.trim();
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("employee-capture ")) {
    return auth.slice("employee-capture ".length).trim();
  }
  try {
    const url = new URL(request.url);
    return url.searchParams.get("captureToken")?.trim() || url.searchParams.get("ct")?.trim() || null;
  } catch {
    return null;
  }
}

export function verifyEmployeeCaptureToken(token: string | null | undefined): EmployeeCaptureClaims | null {
  const normalized = String(token || "").trim();
  if (!normalized) return null;
  const [payload, signature] = normalized.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as EmployeeCaptureClaims;
    if (claims.version !== TOKEN_VERSION) return null;
    if (!claims.vendorId || !claims.bookingId || !claims.membershipId) return null;
    if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function resolveEmployeeCaptureAccess(
  request: Request,
  expected?: { vendorId?: string | null; bookingId?: string | null }
): Promise<EmployeeCaptureAccess | null> {
  const claims = verifyEmployeeCaptureToken(readEmployeeCaptureToken(request));
  if (!claims) return null;
  if (expected?.vendorId && claims.vendorId !== expected.vendorId) return null;
  if (expected?.bookingId && claims.bookingId !== expected.bookingId) return null;

  const membership = await (prisma as any).vendorMembership.findUnique({
    where: { id: claims.membershipId },
    select: {
      id: true,
      vendorId: true,
      userId: true,
      role: true,
      status: true,
      user: { select: { name: true, accountStatus: true } },
      vendor: { select: { accountStatus: true } },
    },
  });
  const normalizedRole = String(membership?.role || "").trim().toUpperCase();
  const normalizedStatus = String(membership?.status || "").trim().toUpperCase();
  if (!membership || membership.vendorId !== claims.vendorId || normalizedRole !== "EMPLOYEE") return null;
  if (normalizedStatus !== "ACTIVE") return null;
  if (normalizeAccountStatus(membership.user?.accountStatus) !== "active") return null;
  if (normalizeAccountStatus(membership.vendor?.accountStatus) !== "active") return null;

  const booking = await prisma.booking.findFirst({
    where: { id: claims.bookingId, vendorId: claims.vendorId },
    select: { id: true, status: true, customerMetadata: true },
  });
  if (!booking) return null;
  if (["CANCELED", "CANCELLED"].includes(String(booking.status || "").trim().toUpperCase())) return null;
  const assigned = parseAssignmentMetadata(booking.customerMetadata);
  if (!assigned.assignedMembershipIds.includes(claims.membershipId)) return null;

  return {
    vendorId: claims.vendorId,
    bookingId: claims.bookingId,
    membershipId: claims.membershipId,
    userId: String(membership.userId),
    role: normalizedRole,
    status: normalizedStatus,
    employeeName: String(membership.user?.name || "").trim() || null,
    token: claims,
  };
}

export function appendEmployeeCaptureToken(url: string, token: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ct=${encodeURIComponent(token)}`;
}
