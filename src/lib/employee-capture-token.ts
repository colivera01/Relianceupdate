import { prisma } from "@/server/db";
import {
  isServiceOrderReleasedForCurrentContext,
  parseAssignmentMetadata,
  parseCustomerMetadata,
} from "@/lib/job-assignment";
import { normalizeAccountStatus } from "@/lib/account-status-shared";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";
import {
  createSignedEmployeeAccessToken,
  verifySignedEmployeeAccessToken,
} from "@/lib/employee-access-token";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const TOKEN_VERSION = 1;
const CONTEXTUAL_TOKEN_VERSION = 2;

export type EmployeeCaptureClaimsV1 = {
  vendorId: string;
  bookingId: string;
  membershipId: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

export type EmployeeCaptureClaimsV2 = Omit<EmployeeCaptureClaimsV1, "version"> & {
  version: 2;
  assignmentGeneration: number;
  assessmentId: string | null;
  assessmentGeneration: number | null;
  scopeHash: string | null;
};

export type EmployeeCaptureClaims = EmployeeCaptureClaimsV1 | EmployeeCaptureClaimsV2;

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

export function createEmployeeCaptureToken(input: {
  vendorId: string;
  bookingId: string;
  membershipId: string;
  ttlSeconds?: number;
  context?: {
    assignmentGeneration: number;
    assessmentId: string | null;
    assessmentGeneration: number | null;
    scopeHash: string | null;
  };
}): string {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    vendorId: String(input.vendorId || "").trim(),
    bookingId: String(input.bookingId || "").trim(),
    membershipId: String(input.membershipId || "").trim(),
    issuedAt: now,
    expiresAt: now + Math.max(60, input.ttlSeconds || TOKEN_TTL_SECONDS),
  };
  const claims: EmployeeCaptureClaims = input.context
    ? {
        ...base,
        version: CONTEXTUAL_TOKEN_VERSION,
        assignmentGeneration: Number(input.context.assignmentGeneration),
        assessmentId: input.context.assessmentId,
        assessmentGeneration: input.context.assessmentGeneration,
        scopeHash: input.context.scopeHash,
      }
    : { ...base, version: TOKEN_VERSION };
  if (!claims.vendorId || !claims.bookingId || !claims.membershipId) {
    throw new Error("Missing employee capture token fields");
  }
  if (
    claims.version === CONTEXTUAL_TOKEN_VERSION &&
    (!Number.isInteger(claims.assignmentGeneration) || claims.assignmentGeneration < 1)
  ) {
    throw new Error("Invalid employee capture token context");
  }
  return createSignedEmployeeAccessToken(claims);
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
  const claims = verifySignedEmployeeAccessToken<EmployeeCaptureClaims>(token);
  if (!claims || ![TOKEN_VERSION, CONTEXTUAL_TOKEN_VERSION].includes(Number(claims.version))) return null;
  if (!claims.vendorId || !claims.bookingId || !claims.membershipId) return null;
  if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  if (
    claims.version === CONTEXTUAL_TOKEN_VERSION &&
    (!Number.isInteger(claims.assignmentGeneration) || claims.assignmentGeneration < 1)
  ) {
    return null;
  }
  return claims;
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

  const assessmentModel = (prisma as any).recordingScopeAssessment;
  if (!assessmentModel?.findFirst && process.env.NODE_ENV !== "test") return null;
  const currentAssessment = await assessmentModel?.findFirst?.({
    where: {
      bookingId: claims.bookingId,
      vendorId: claims.vendorId,
      isCurrent: true,
    },
    select: {
      id: true,
      generation: true,
      scopeHash: true,
      contractVersion: true,
    },
  });
  if (currentAssessment?.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    if (claims.version !== CONTEXTUAL_TOKEN_VERSION) return null;
    const metadata = parseCustomerMetadata(booking.customerMetadata);
    const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);
    const exactContext =
      claims.assignmentGeneration === assignmentGeneration &&
      claims.assessmentId === currentAssessment.id &&
      claims.assessmentGeneration === Number(currentAssessment.generation) &&
      claims.scopeHash === currentAssessment.scopeHash;
    if (!exactContext) return null;
    if (
      !isServiceOrderReleasedForCurrentContext(booking.customerMetadata, {
        membershipId: claims.membershipId,
        assignmentGeneration,
        assessmentId: currentAssessment.id,
        assessmentGeneration: Number(currentAssessment.generation),
        scopeHash: currentAssessment.scopeHash,
      })
    ) {
      return null;
    }
  }

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
