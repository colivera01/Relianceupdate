import { randomUUID } from "node:crypto";

import { stableJson } from "@/lib/consent/content-version";
import {
  createOtp,
  evaluateOtpAttempt,
  hashOtp,
  PERMISSION_OTP_MAX_ATTEMPTS,
  PERMISSION_OTP_TTL_MINUTES,
} from "@/lib/consent/otp";
import {
  buildPermissionRecipient,
  hashPermissionContact,
} from "@/lib/consent/recipient";
import { createOpaqueSecret, hashOpaqueSecret } from "@/lib/consent/token";
import { parseAssignmentMetadata, parseCustomerMetadata } from "@/lib/job-assignment";
import { interpretRecordingAssessment } from "@/lib/recording/assessment-reader";

export const EMPLOYEE_DECISION_PURPOSES = {
  RECORDING: "EMPLOYEE_RECORDING_PARTICIPATION",
  STANDING_PUBLIC: "EMPLOYEE_STANDING_PUBLIC_MEDIA",
} as const;

export type EmployeeDecisionPurpose =
  (typeof EMPLOYEE_DECISION_PURPOSES)[keyof typeof EMPLOYEE_DECISION_PURPOSES];

export const EMPLOYEE_DECISION_COOKIE = "reliance_employee_decision";
export const EMPLOYEE_DECISION_SESSION_TTL_MINUTES = 20;
export const EMPLOYEE_DECISION_RESEND_COOLDOWN_SECONDS = 60;
export const EMPLOYEE_DECISION_MAX_STARTS_PER_HOUR = 5;

export type EmployeeDecisionContext = {
  purpose: EmployeeDecisionPurpose;
  userId: string;
  vendorId: string;
  membershipId: string;
  membershipGeneration: number;
  bookingId: string | null;
  assignmentGeneration: number | null;
  assessmentId: string | null;
  assessmentGeneration: number | null;
  scopeHash: string | null;
  audioAllowed: boolean | null;
  recordingBoundary: string | null;
  participantPlan: string | null;
  contextHash: string;
  employeeName: string;
  vendorName: string;
  serviceName: string | null;
  recipient: ReturnType<typeof buildPermissionRecipient>;
};

function canonicalContextDocument(
  context: Omit<
    EmployeeDecisionContext,
    "contextHash" | "employeeName" | "vendorName" | "serviceName" | "recipient"
  >,
) {
  return {
    version: 1,
    purpose: context.purpose,
    userId: context.userId,
    vendorId: context.vendorId,
    membershipId: context.membershipId,
    membershipGeneration: context.membershipGeneration,
    bookingId: context.bookingId,
    assignmentGeneration: context.assignmentGeneration,
    assessmentId: context.assessmentId,
    assessmentGeneration: context.assessmentGeneration,
    scopeHash: context.scopeHash,
    audioAllowed: context.audioAllowed,
    recordingBoundary: context.recordingBoundary,
    participantPlan: context.participantPlan,
  };
}

export function employeeDecisionContextHash(
  context: Parameters<typeof canonicalContextDocument>[0],
): string {
  return hashOpaqueSecret(stableJson(canonicalContextDocument(context)));
}

function recordingContextFromAssessment(assessment: any) {
  const interpretation = interpretRecordingAssessment(assessment);
  if (interpretation.kind === "SIMPLIFIED_V1") {
    return {
      participantPlan: interpretation.canonical.intentionalParticipantPlan,
      recordingBoundary: interpretation.canonical.recordingBoundary,
      includesAssignedEmployee: [
        "assigned_service_professional",
        "customer_and_assigned_service_professional",
      ].includes(interpretation.canonical.intentionalParticipantPlan),
    };
  }
  if (interpretation.kind === "V2") {
    return {
      participantPlan: stableJson(interpretation.canonical.assessment.expectedPeople),
      recordingBoundary: stableJson(interpretation.canonical.assessment.recordingArea),
      includesAssignedEmployee:
        interpretation.canonical.assessment.expectedPeople.includes(
          "ASSIGNED_SERVICE_PROFESSIONAL",
        ),
    };
  }
  return {
    participantPlan: String(assessment.peopleScope || "historical"),
    recordingBoundary: String(assessment.frameControl || "historical"),
    includesAssignedEmployee: false,
  };
}

export async function loadEmployeeDecisionContext(input: {
  db: any;
  purpose: EmployeeDecisionPurpose;
  userId: string;
  membershipId: string;
  bookingId?: string | null;
}): Promise<EmployeeDecisionContext> {
  const membership = await input.db.vendorMembership.findUnique({
    where: { id: input.membershipId },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      role: true,
      status: true,
      membershipGeneration: true,
      user: { select: { name: true, email: true, phone: true } },
      vendor: { select: { name: true, businessName: true } },
    },
  });
  if (
    !membership ||
    membership.userId !== input.userId ||
    String(membership.role || "").toUpperCase() !== "EMPLOYEE" ||
    String(membership.status || "").toUpperCase() !== "ACTIVE"
  ) {
    throw new Error("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN");
  }

  let recordingFields = {
    bookingId: null as string | null,
    assignmentGeneration: null as number | null,
    assessmentId: null as string | null,
    assessmentGeneration: null as number | null,
    scopeHash: null as string | null,
    audioAllowed: null as boolean | null,
    recordingBoundary: null as string | null,
    participantPlan: null as string | null,
    serviceName: null as string | null,
  };

  if (input.purpose === EMPLOYEE_DECISION_PURPOSES.RECORDING) {
    if (!input.bookingId) throw new Error("EMPLOYEE_RECORDING_CONTEXT_REQUIRED");
    const booking = await input.db.booking.findFirst({
      where: { id: input.bookingId, vendorId: membership.vendorId },
      select: {
        id: true,
        customerMetadata: true,
        title: true,
        service: { select: { name: true } },
      },
    });
    if (!booking) throw new Error("EMPLOYEE_RECORDING_CONTEXT_NOT_FOUND");
    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    if (!assignment.assignedMembershipIds.includes(membership.id)) {
      throw new Error("EMPLOYEE_RECORDING_ASSIGNMENT_STALE");
    }
    const metadata = parseCustomerMetadata(booking.customerMetadata);
    const assignmentGeneration = Number(
      metadata.vendor_job_assignment_generation || 1,
    );
    if (!Number.isInteger(assignmentGeneration) || assignmentGeneration < 1) {
      throw new Error("EMPLOYEE_RECORDING_ASSIGNMENT_STALE");
    }
    const assessment = await input.db.recordingScopeAssessment.findFirst({
      where: {
        bookingId: booking.id,
        vendorId: membership.vendorId,
        isCurrent: true,
        status: "COMPLETE",
      },
      orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
    });
    if (!assessment) throw new Error("EMPLOYEE_RECORDING_ASSESSMENT_REQUIRED");
    const assessmentContext = recordingContextFromAssessment(assessment);
    if (!assessmentContext.includesAssignedEmployee) {
      throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_NOT_APPLICABLE");
    }
    recordingFields = {
      bookingId: booking.id,
      assignmentGeneration,
      assessmentId: assessment.id,
      assessmentGeneration: Number(assessment.generation),
      scopeHash: String(assessment.scopeHash),
      audioAllowed: assessment.audioAllowed === true,
      recordingBoundary: assessmentContext.recordingBoundary,
      participantPlan: assessmentContext.participantPlan,
      serviceName: String(booking.service?.name || booking.title || "Service"),
    };
  }

  const core = {
    purpose: input.purpose,
    userId: membership.userId,
    vendorId: membership.vendorId,
    membershipId: membership.id,
    membershipGeneration: Number(membership.membershipGeneration || 1),
    bookingId: recordingFields.bookingId,
    assignmentGeneration: recordingFields.assignmentGeneration,
    assessmentId: recordingFields.assessmentId,
    assessmentGeneration: recordingFields.assessmentGeneration,
    scopeHash: recordingFields.scopeHash,
    audioAllowed: recordingFields.audioAllowed,
    recordingBoundary: recordingFields.recordingBoundary,
    participantPlan: recordingFields.participantPlan,
  };
  return {
    ...core,
    contextHash: employeeDecisionContextHash(core),
    employeeName: String(membership.user?.name || "Employee"),
    vendorName: String(
      membership.vendor?.businessName || membership.vendor?.name || "Reliance business",
    ),
    serviceName: recordingFields.serviceName,
    recipient: buildPermissionRecipient(membership.user || {}),
  };
}

export function employeeDecisionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/employee",
    maxAge: EMPLOYEE_DECISION_SESSION_TTL_MINUTES * 60,
  };
}

export function readEmployeeDecisionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === EMPLOYEE_DECISION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function requestIpAddress(request: Request): string {
  return String(
    request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
  )
    .split(",")[0]
    .trim();
}

export function requestIpHash(request: Request): string {
  return hashOpaqueSecret(`employee-decision-ip:${requestIpAddress(request)}`);
}

export async function startEmployeeDecisionVerification(input: {
  db: any;
  context: EmployeeDecisionContext;
  channel: "email" | "sms";
  requestIpHash: string;
  now?: Date;
  deliver: (input: {
    channel: "email" | "sms";
    destination: string;
    code: string;
    employeeName: string;
    vendorName: string;
    serviceName: string | null;
    purpose: EmployeeDecisionPurpose;
  }) => Promise<{
    ok: boolean;
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
}) {
  const now = input.now || new Date();
  const destination =
    input.channel === "email"
      ? input.context.recipient.email
      : input.context.recipient.phone;
  const destinationHash = hashPermissionContact(destination);
  if (!destination || !destinationHash) {
    throw new Error("EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE");
  }
  const challengeId = randomUUID();
  const code = createOtp();
  const expiresAt = new Date(
    now.getTime() + PERMISSION_OTP_TTL_MINUTES * 60 * 1000,
  );
  const cooldownAt = new Date(
    now.getTime() - EMPLOYEE_DECISION_RESEND_COOLDOWN_SECONDS * 1000,
  );
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const createChallenge = async (tx: any) => {
    const latest = await tx.employeeDecisionVerificationChallenge.findFirst({
      where: {
        membershipId: input.context.membershipId,
        purpose: input.context.purpose,
        channel: input.channel,
      },
      orderBy: { createdAt: "desc" },
    });
    if (latest && new Date(latest.createdAt).getTime() > cooldownAt.getTime()) {
      throw new Error("EMPLOYEE_DECISION_RESEND_COOLDOWN");
    }
    const starts = await tx.employeeDecisionVerificationChallenge.count({
      where: {
        createdAt: { gte: since },
        OR: [
          {
            membershipId: input.context.membershipId,
            purpose: input.context.purpose,
            channel: input.channel,
          },
          { requestIpHash: input.requestIpHash },
        ],
      },
    });
    if (starts >= EMPLOYEE_DECISION_MAX_STARTS_PER_HOUR) {
      throw new Error("EMPLOYEE_DECISION_RATE_LIMITED");
    }
    await tx.employeeDecisionVerificationChallenge.create({
      data: {
        id: challengeId,
        userId: input.context.userId,
        vendorId: input.context.vendorId,
        membershipId: input.context.membershipId,
        membershipGeneration: input.context.membershipGeneration,
        bookingId: input.context.bookingId,
        assessmentId: input.context.assessmentId,
        assignmentGeneration: input.context.assignmentGeneration,
        purpose: input.context.purpose,
        contextHash: input.context.contextHash,
        channel: input.channel,
        destinationHash,
        codeHash: hashOtp(code, challengeId),
        expiresAt,
        maxAttempts: PERMISSION_OTP_MAX_ATTEMPTS,
        requestIpHash: input.requestIpHash,
      },
    });
  };
  if (typeof input.db.$transaction === "function") {
    await input.db.$transaction(createChallenge, { isolationLevel: "Serializable" });
  } else {
    await createChallenge(input.db);
  }
  let delivery: Awaited<ReturnType<typeof input.deliver>>;
  try {
    delivery = await input.deliver({
      channel: input.channel,
      destination,
      code,
      employeeName: input.context.employeeName,
      vendorName: input.context.vendorName,
      serviceName: input.context.serviceName,
      purpose: input.context.purpose,
    });
  } catch (error) {
    delivery = {
      ok: false,
      errorCode: "EMPLOYEE_DECISION_OTP_PROVIDER_ERROR",
      errorMessage: error instanceof Error ? error.message : "OTP delivery failed",
    };
  }
  await input.db.employeeDecisionVerificationChallenge.update({
    where: { id: challengeId },
    data: {
      deliveryStatus: delivery.ok ? "SENT" : "FAILED",
      deliveryReference: delivery.providerMessageId || null,
      deliveryError: delivery.errorMessage || delivery.errorCode || null,
    },
  });
  if (!delivery.ok) {
    throw new Error("EMPLOYEE_DECISION_OTP_DELIVERY_FAILED");
  }
  return {
    challengeId,
    expiresAt,
    deliveryStatus: delivery.ok ? "SENT" : "FAILED",
    destinationMasked:
      input.channel === "email"
        ? input.context.recipient.emailMasked
        : input.context.recipient.phoneMasked,
  };
}

export async function verifyEmployeeDecisionOtp(input: {
  db: any;
  challengeId: string;
  code: string;
  expectedContext: EmployeeDecisionContext;
  now?: Date;
}) {
  const now = input.now || new Date();
  return input.db.$transaction(async (tx: any) => {
    const challenge = await tx.employeeDecisionVerificationChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (
      !challenge ||
      challenge.contextHash !== input.expectedContext.contextHash ||
      challenge.userId !== input.expectedContext.userId ||
      challenge.vendorId !== input.expectedContext.vendorId ||
      challenge.membershipId !== input.expectedContext.membershipId ||
      Number(challenge.membershipGeneration) !==
        input.expectedContext.membershipGeneration ||
      challenge.purpose !== input.expectedContext.purpose ||
      challenge.deliveryStatus !== "SENT"
    ) {
      throw new Error("EMPLOYEE_DECISION_VERIFICATION_FAILED");
    }
    const result = evaluateOtpAttempt({
      expectedHash: challenge.codeHash,
      suppliedCode: input.code,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      failedAttempts: challenge.failedAttempts,
      maxAttempts: challenge.maxAttempts,
      consumedAt: challenge.consumedAt,
      now,
    });
    if (!result.ok) {
      if (result.reason === "incorrect") {
        await tx.employeeDecisionVerificationChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { failedAttempts: { increment: 1 } },
        });
      }
      throw new Error(`EMPLOYEE_DECISION_OTP_${result.reason.toUpperCase()}`);
    }
    const consumed = await tx.employeeDecisionVerificationChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: challenge.maxAttempts },
      },
      data: { consumedAt: now, verifiedAt: now },
    });
    if (Number(consumed.count || 0) !== 1) {
      throw new Error("EMPLOYEE_DECISION_OTP_REPLAYED");
    }
    const secret = createOpaqueSecret();
    const expiresAt = new Date(
      now.getTime() + EMPLOYEE_DECISION_SESSION_TTL_MINUTES * 60 * 1000,
    );
    const session = await tx.employeeVerifiedDecisionSession.create({
      data: {
        challengeId: challenge.id,
        secretHash: hashOpaqueSecret(secret),
        userId: challenge.userId,
        vendorId: challenge.vendorId,
        membershipId: challenge.membershipId,
        membershipGeneration: challenge.membershipGeneration,
        bookingId: challenge.bookingId,
        assessmentId: challenge.assessmentId,
        assignmentGeneration: challenge.assignmentGeneration,
        purpose: challenge.purpose,
        contextHash: challenge.contextHash,
        verifiedChannel: challenge.channel,
        verifiedContactHash: challenge.destinationHash,
        expiresAt,
      },
    });
    return { session, secret, expiresAt };
  }, { isolationLevel: "Serializable" });
}

export async function consumeEmployeeDecisionSession(input: {
  tx: any;
  secret: string;
  context: EmployeeDecisionContext;
  consumedByType: string;
  consumedById: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const session = await input.tx.employeeVerifiedDecisionSession.findUnique({
    where: { secretHash: hashOpaqueSecret(input.secret) },
  });
  if (
    !session ||
    session.consumedAt ||
    new Date(session.expiresAt).getTime() <= now.getTime() ||
    session.purpose !== input.context.purpose ||
    session.contextHash !== input.context.contextHash ||
    session.userId !== input.context.userId ||
    session.vendorId !== input.context.vendorId ||
    session.membershipId !== input.context.membershipId ||
    Number(session.membershipGeneration) !== input.context.membershipGeneration
  ) {
    throw new Error("EMPLOYEE_DECISION_SESSION_INVALID");
  }
  const consumed = await input.tx.employeeVerifiedDecisionSession.updateMany({
    where: { id: session.id, consumedAt: null, expiresAt: { gt: now } },
    data: {
      consumedAt: now,
      consumedByType: input.consumedByType,
      consumedById: input.consumedById,
    },
  });
  if (Number(consumed.count || 0) !== 1) {
    throw new Error("EMPLOYEE_DECISION_SESSION_REPLAYED");
  }
  return session;
}
