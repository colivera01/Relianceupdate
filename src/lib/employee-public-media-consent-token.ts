import { normalizeAccountStatus } from "@/lib/account-status-shared";
import {
  createSignedEmployeeAccessToken,
  verifySignedEmployeeAccessToken,
} from "@/lib/employee-access-token";
import { prisma } from "@/server/db";

const TOKEN_TTL_SECONDS = 60 * 60;
const TOKEN_VERSION = 1;
const TOKEN_PURPOSE = "employee-public-media-consent";

export type EmployeePublicMediaConsentClaims = {
  purpose: typeof TOKEN_PURPOSE;
  vendorId: string;
  membershipId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

export type EmployeePublicMediaConsentAccess = {
  vendorId: string;
  membershipId: string;
  userId: string;
  employeeName: string | null;
  vendorName: string;
  expiresAt: number;
};

export function createEmployeePublicMediaConsentToken(input: {
  vendorId: string;
  membershipId: string;
  userId: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: EmployeePublicMediaConsentClaims = {
    purpose: TOKEN_PURPOSE,
    vendorId: String(input.vendorId || "").trim(),
    membershipId: String(input.membershipId || "").trim(),
    userId: String(input.userId || "").trim(),
    issuedAt: now,
    expiresAt: now + Math.max(60, input.ttlSeconds || TOKEN_TTL_SECONDS),
    version: TOKEN_VERSION,
  };
  if (!claims.vendorId || !claims.membershipId || !claims.userId) {
    throw new Error("Missing Employee participation token fields");
  }
  return createSignedEmployeeAccessToken(claims);
}

export function readEmployeePublicMediaConsentToken(request: Request): string | null {
  const header = request.headers.get("x-employee-public-media-consent-token");
  if (header?.trim()) return header.trim();
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("employee-public-media-consent ")) {
    return auth.slice("employee-public-media-consent ".length).trim();
  }
  try {
    const url = new URL(request.url);
    return url.searchParams.get("consentToken")?.trim() || url.searchParams.get("pct")?.trim() || null;
  } catch {
    return null;
  }
}

export function verifyEmployeePublicMediaConsentToken(
  token: string | null | undefined,
): EmployeePublicMediaConsentClaims | null {
  const claims = verifySignedEmployeeAccessToken<EmployeePublicMediaConsentClaims>(token);
  if (!claims || claims.version !== TOKEN_VERSION || claims.purpose !== TOKEN_PURPOSE) return null;
  if (!claims.vendorId || !claims.membershipId || !claims.userId) return null;
  if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export async function resolveEmployeePublicMediaConsentAccess(
  request: Request,
): Promise<EmployeePublicMediaConsentAccess | null> {
  const claims = verifyEmployeePublicMediaConsentToken(readEmployeePublicMediaConsentToken(request));
  if (!claims) return null;
  const membership = await (prisma as any).vendorMembership.findUnique({
    where: { id: claims.membershipId },
    select: {
      id: true,
      vendorId: true,
      userId: true,
      role: true,
      status: true,
      user: { select: { name: true, accountStatus: true } },
      vendor: { select: { name: true, businessName: true, accountStatus: true } },
    },
  });
  if (
    !membership ||
    membership.vendorId !== claims.vendorId ||
    membership.userId !== claims.userId ||
    String(membership.role || "").trim().toUpperCase() !== "EMPLOYEE" ||
    String(membership.status || "").trim().toUpperCase() !== "ACTIVE" ||
    normalizeAccountStatus(membership.user?.accountStatus) !== "active" ||
    normalizeAccountStatus(membership.vendor?.accountStatus) !== "active"
  ) return null;
  return {
    vendorId: claims.vendorId,
    membershipId: claims.membershipId,
    userId: claims.userId,
    employeeName: String(membership.user?.name || "").trim() || null,
    vendorName: String(membership.vendor?.businessName || membership.vendor?.name || "Reliance business"),
    expiresAt: claims.expiresAt,
  };
}

export function appendEmployeePublicMediaConsentToken(url: string, token: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pct=${encodeURIComponent(token)}`;
}
