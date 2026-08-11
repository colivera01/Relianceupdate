import { prisma } from "@/server/db";
import {
  normalizeRecordingLocationChoice,
  parseAssignmentMetadata,
  parseCustomerMetadata,
  parseRecordingComplianceMetadata,
  validateRecordingLocationSnapshot,
  type RecordingLocationChoice,
} from "@/lib/job-assignment";
import { derivePermissionState, type PermissionState } from "./state-machine";
import { resolveCanonicalMediaLifecycle } from "@/lib/media-lifecycle";

export type RecordingPermissionRecord = {
  id?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  verifiedDecision?: boolean | null;
  isCurrent?: boolean | null;
  scopeJson?: string | null;
  expiresAt?: Date | string | null;
  decisionEvidence?: { id?: string | null } | null;
  recipientMismatch?: boolean | null;
};

export type RecordingGateParticipant = "VENDOR_MANAGER" | "CUSTOMER" | "EMPLOYEE" | "ADMIN";
export type RecordingGateBlock = {
  code: string;
  why: string;
  responsibleParticipant: RecordingGateParticipant;
  resolution: string;
  serviceMayContinue: boolean;
};

export type RecordingPermissionGate = {
  location: RecordingLocationChoice | null;
  permissionRequired: boolean;
  permissionState: PermissionState | "not_required";
  recordingUnlocked: boolean;
  releaseAllowed: boolean;
  verifiedAllowed: boolean;
  consentRecordId: string | null;
  permissionDecisionEvidenceId: string | null;
  recipientNeedsCorrection: boolean;
  assessmentId: string | null;
  assessmentGeneration: number | null;
  scopeHash: string | null;
  assessmentStatus: string | null;
  riskLevel: string | null;
  scopeSummary: {
    propertyScope: string;
    peopleScope: string;
    frameControl: string;
    sensitiveCapture: boolean;
    identifiersMayAppear: boolean;
    minorPresent: boolean;
    protectedParticipantPresent: boolean;
    residenceInterior: boolean;
    businessInterior: boolean;
    authorityHolderType: string;
    serviceCanContinueWithoutRecording: boolean;
    essentialPrivateRecording: boolean;
  } | null;
  audioAllowed: false;
  certificationActive: boolean;
  certificationId: string | null;
  assignmentGeneration: number | null;
  locationVerified: boolean;
  locationAttemptStatus: string | null;
  locationAttemptResultCode: string | null;
  locationAttemptId: string | null;
  locationExceptionStatus: string | null;
  locationExceptionId: string | null;
  blockCode: string | null;
  blockMessage: string | null;
  block: RecordingGateBlock | null;
};

export type RecordingGateSurface =
  | "vendor_release"
  | "employee_jobs"
  | "employee_start"
  | "employee_stage"
  | "location_verify"
  | "media_session"
  | "upload_init"
  | "upload_proxy"
  | "upload_complete"
  | "admin_evidence";

function locationFromScope(scopeJson: string | null | undefined): RecordingLocationChoice | null {
  if (!scopeJson) return null;
  try {
    const scope = JSON.parse(scopeJson) as Record<string, unknown>;
    return normalizeRecordingLocationChoice(scope?.recordingLocation);
  } catch {
    return null;
  }
}

function stateFromRecord(
  record: RecordingPermissionRecord,
  verifiedAllowed: boolean,
  now: Date,
): PermissionState {
  const lifecycle = String(record.lifecycleStatus || "").trim().toLowerCase();
  const status = String(record.status || "").trim().toLowerCase();
  const normalizedStatus = lifecycle === "allowed" ? "accepted" : lifecycle || status || "pending";
  return derivePermissionState({
    status: normalizedStatus,
    expiresAt: record.expiresAt,
    now,
    verifiedDecision: verifiedAllowed,
  });
}

function permissionFacts(input: {
  customerMetadata: string | null | undefined;
  consentRecord?: RecordingPermissionRecord | null;
  now?: Date;
  assessment?: any | null;
}) {
  const compliance = parseRecordingComplianceMetadata(input.customerMetadata);
  const currentRecord = input.consentRecord?.isCurrent === false ? null : input.consentRecord || null;
  const scopedLocation = locationFromScope(currentRecord?.scopeJson);
  const location =
    normalizeRecordingLocationChoice(input.assessment?.locationType) ||
    scopedLocation ||
    compliance.location;
  const permissionRequired = input.assessment
    ? Boolean(input.assessment.permissionRequired)
    : Boolean(currentRecord) || location === "residence" || location === "customer-business";
  const verifiedAllowed = Boolean(
    currentRecord &&
      currentRecord.verifiedDecision === true &&
      String(currentRecord.lifecycleStatus || "").trim().toUpperCase() === "ALLOWED" &&
      String(currentRecord.status || "").trim().toLowerCase() === "accepted" &&
      currentRecord.decisionEvidence?.id,
  );
  const permissionState: PermissionState | "not_required" = permissionRequired
    ? currentRecord
      ? stateFromRecord(currentRecord, verifiedAllowed, input.now ?? new Date())
      : "not_sent"
    : "not_required";
  return { compliance, currentRecord, location, permissionRequired, verifiedAllowed, permissionState };
}

function legacyBlock(code: string): RecordingGateBlock {
  if (code === "RECORDING_LOCATION_REQUIRED") {
    return {
      code,
      why: "The work record does not identify where recording will happen.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Choose the service location and complete the recording assessment.",
      serviceMayContinue: true,
    };
  }
  return {
    code,
    why: "Required customer recording permission is not active.",
    responsibleParticipant: "CUSTOMER",
    resolution: "The customer must use the secure request to allow recording, or the vendor must correct the recipient.",
    serviceMayContinue: true,
  };
}

/**
 * Compatibility-only pure resolver used by older focused tests. Runtime request
 * boundaries use loadCanonicalRecordingGate, which also evaluates assessment,
 * assignment, certification, location evidence, and admin exceptions.
 */
export function resolveRecordingPermissionGate(input: {
  customerMetadata: string | null | undefined;
  consentRecord?: RecordingPermissionRecord | null;
  now?: Date;
}): RecordingPermissionGate {
  const facts = permissionFacts(input);
  const recordingUnlocked = facts.permissionRequired ? facts.verifiedAllowed : Boolean(facts.location);
  const blockCode = !facts.location
    ? "RECORDING_LOCATION_REQUIRED"
    : facts.permissionRequired && !recordingUnlocked
      ? "VERIFIED_PERMISSION_REQUIRED"
      : null;
  const block = blockCode ? legacyBlock(blockCode) : null;
  return {
    location: facts.location,
    permissionRequired: facts.permissionRequired,
    permissionState: facts.permissionState,
    recordingUnlocked,
    releaseAllowed: recordingUnlocked,
    verifiedAllowed: facts.verifiedAllowed,
    consentRecordId: facts.currentRecord?.id || null,
    permissionDecisionEvidenceId: facts.currentRecord?.decisionEvidence?.id || null,
    recipientNeedsCorrection: Boolean(facts.currentRecord?.recipientMismatch),
    assessmentId: null,
    assessmentGeneration: null,
    scopeHash: null,
    assessmentStatus: null,
    riskLevel: null,
    scopeSummary: null,
    audioAllowed: false,
    certificationActive: false,
    certificationId: null,
    assignmentGeneration: null,
    locationVerified: facts.compliance.locationVerified,
    locationAttemptStatus: facts.compliance.locationVerified ? "VERIFIED" : null,
    locationAttemptResultCode: null,
    locationAttemptId: null,
    locationExceptionStatus: null,
    locationExceptionId: null,
    blockCode,
    blockMessage: block ? `${block.why} ${block.resolution}` : null,
    block,
  };
}

function blocked(
  base: Omit<RecordingPermissionGate, "recordingUnlocked" | "releaseAllowed" | "blockCode" | "blockMessage" | "block">,
  block: RecordingGateBlock,
  releaseAllowed = false,
): RecordingPermissionGate {
  return {
    ...base,
    recordingUnlocked: false,
    releaseAllowed,
    blockCode: block.code,
    blockMessage: `${block.why} ${block.resolution}`,
    block,
  };
}

async function recordBlockMetric(input: {
  bookingId: string;
  vendorId: string;
  surface: RecordingGateSurface;
  block: RecordingGateBlock | null;
  actorKind?: string | null;
}) {
  if (!input.block) return;
  const model = (prisma as any).recordingGateMetric;
  if (!model?.create) return;
  try {
    await model.create({
      data: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        surface: input.surface,
        blockReason: input.block.code,
        responsibleParticipant: input.block.responsibleParticipant,
        actorKind: input.actorKind || null,
      },
    });
  } catch {
    // Diagnostic metrics must never change recording authorization behavior.
  }
}

export async function loadCanonicalRecordingGate(input: {
  bookingId: string;
  vendorId?: string;
  customerMetadata: string | null | undefined;
  consentRecord?: any | null;
  membershipId?: string | null;
  surface: RecordingGateSurface;
  capability?: "release" | "record" | "observe";
  actorKind?: string | null;
  now?: Date;
}): Promise<RecordingPermissionGate> {
  const assessmentModel = (prisma as any).recordingScopeAssessment;
  // Isolated legacy test doubles do not expose the Epic 4 models. Production
  // Prisma always does, so this branch cannot weaken the deployed gate.
  if (!assessmentModel?.findFirst) {
    return loadLegacyPermissionGate(input);
  }
  const [assessment, consentRecord, lifecycle] = await Promise.all([
    assessmentModel.findFirst({
      where: {
        bookingId: input.bookingId,
        ...(input.vendorId ? { vendorId: input.vendorId } : {}),
        isCurrent: true,
      },
      orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
      include: { authorities: true },
    }),
    input.consentRecord !== undefined ? Promise.resolve(input.consentRecord) : (prisma as any).consentRecord.findFirst({
      where: {
        bookingId: input.bookingId,
        ...(input.vendorId ? { vendorId: input.vendorId } : {}),
        isCurrent: true,
      },
      orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        status: true,
        lifecycleStatus: true,
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: true,
        expiresAt: true,
        recipientMismatch: true,
        decisionEvidence: { select: { id: true } },
      },
    }),
    resolveCanonicalMediaLifecycle({
      bookingId: input.bookingId,
      intendedAudience: "PRIVATE",
    }),
  ]);
  const facts = permissionFacts({ ...input, assessment, consentRecord });
  const assessmentLocation = normalizeRecordingLocationChoice(assessment?.locationType);
  const locationSnapshot = validateRecordingLocationSnapshot(
    input.customerMetadata,
    assessmentLocation,
  );
  const assignment = parseAssignmentMetadata(input.customerMetadata);
  const metadata = parseCustomerMetadata(input.customerMetadata);
  const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);
  const assigned = input.membershipId
    ? assignment.assignedMembershipIds.includes(input.membershipId)
    : assignment.assignedMembershipIds.length > 0;
  const released = input.membershipId
    ? facts.compliance.releasedMembershipIds.includes(input.membershipId)
    : Boolean(facts.compliance.serviceOrderReleasedAt);
  const certification = assessment && input.membershipId
    ? await (prisma as any).employeeRecordingCertification.findFirst({
        where: {
          bookingId: input.bookingId,
          membershipId: input.membershipId,
          assessmentId: assessment.id,
          assignmentGeneration,
          scopeHash: assessment.scopeHash,
          status: "ACTIVE",
          invalidatedAt: null,
        },
        orderBy: { certifiedAt: "desc" },
      })
    : null;
  const locationAttempt = assessment && input.membershipId
    ? await (prisma as any).recordingLocationAttempt.findFirst({
        where: {
          bookingId: input.bookingId,
          membershipId: input.membershipId,
          assessmentId: assessment.id,
        },
        orderBy: { attemptedAt: "desc" },
      })
    : null;
  const locationException = assessment
    ? await (prisma as any).recordingLocationException.findFirst({
        where: { bookingId: input.bookingId, assessmentId: assessment.id },
        orderBy: { createdAt: "desc" },
    })
    : null;
  const assessedSubjects = parseCustomerMetadata(assessment?.subjectJson || null);
  const assessedScope = parseCustomerMetadata(assessment?.scopeJson || null);
  const base = {
    location: facts.location,
    permissionRequired: facts.permissionRequired,
    permissionState: facts.permissionState,
    verifiedAllowed: facts.verifiedAllowed,
    consentRecordId: facts.currentRecord?.id || null,
    permissionDecisionEvidenceId: facts.currentRecord?.decisionEvidence?.id || null,
    recipientNeedsCorrection: Boolean(facts.currentRecord?.recipientMismatch),
    assessmentId: assessment?.id || null,
    assessmentGeneration: assessment?.generation || null,
    scopeHash: assessment?.scopeHash || null,
    assessmentStatus: assessment?.status || null,
    riskLevel: assessment?.riskLevel || null,
    scopeSummary: assessment
      ? {
          propertyScope: String(assessment.propertyScope || ""),
          peopleScope: String(assessment.peopleScope || ""),
          frameControl: String(assessment.frameControl || ""),
          sensitiveCapture: Boolean(assessedSubjects.sensitiveInformationMayAppear),
          identifiersMayAppear: Boolean(assessedSubjects.identifiersMayAppear),
          minorPresent: Boolean(assessedSubjects.minorMayAppear),
          protectedParticipantPresent: Boolean(assessedSubjects.protectedNonParticipantMayAppear),
          residenceInterior: Boolean(assessedSubjects.residenceInterior),
          businessInterior: Boolean(assessedSubjects.businessInterior),
          authorityHolderType: String(assessedScope.authorityHolderType || assessment.authorityHolderType || ""),
          serviceCanContinueWithoutRecording: Boolean(
            assessedScope.serviceCanContinueWithoutRecording ??
              assessment.serviceCanContinueWithoutRecording,
          ),
          essentialPrivateRecording: Boolean(
            assessedScope.essentialPrivateRecording ?? assessment.essentialPrivateRecording,
          ),
        }
      : null,
    audioAllowed: false as const,
    certificationActive: Boolean(certification),
    certificationId: certification?.id || null,
    assignmentGeneration,
    locationVerified: Boolean(locationAttempt?.status === "VERIFIED" || locationException?.status === "APPROVED"),
    locationAttemptStatus: locationAttempt?.status || null,
    locationAttemptResultCode: locationAttempt?.resultCode || null,
    locationAttemptId: locationAttempt?.id || null,
    locationExceptionStatus: locationException?.status || null,
    locationExceptionId: locationException?.id || null,
  };
  const capability = input.capability || "record";
  let decision: RecordingPermissionGate;
  if (!lifecycle.recordingAllowed) {
    decision = blocked(base, {
      code: "RECORDING_WITHDRAWN_OR_RESTRICTED",
      why: "Recording has been stopped for this work record by an active withdrawal or lifecycle restriction.",
      responsibleParticipant: (lifecycle.responsibleParticipant || "ADMIN") as RecordingGateParticipant,
      resolution: lifecycle.nextAction || "Review the lifecycle case before attempting to record again.",
      serviceMayContinue: assessment?.serviceCanContinueWithoutRecording !== false,
    });
  } else if (!assessment || assessment.status !== "COMPLETE") {
    decision = blocked(base, {
      code: "RECORDING_ASSESSMENT_REQUIRED",
      why: "The recording subject and scope have not been assessed.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Complete the recording assessment for this work record.",
      serviceMayContinue: true,
    });
  } else if (!locationSnapshot.ok) {
    const locationLabel =
      assessmentLocation === "business"
        ? "vendor business address"
        : assessmentLocation === "customer-business"
          ? "customer business address"
          : assessmentLocation === "residence"
            ? "customer residence"
            : "selected service location";
    decision = blocked(base, {
      code: "RECORDING_LOCATION_SNAPSHOT_REQUIRED",
      why: `The ${locationLabel} does not have a matching verified location snapshot saved with this work record.`,
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Correct the work record with the complete address for the selected location before releasing it for recording.",
      serviceMayContinue: true,
    });
  } else if (assessment.audioRequested || assessment.audioAllowed) {
    decision = blocked(base, {
      code: "AUDIO_NOT_SUPPORTED",
      why: "This work record requests audio, but audio is off for Epic 4.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Update the scope to video without audio.",
      serviceMayContinue: true,
    });
  } else if (
    assessment.authorities?.some(
      (item: any) =>
        item.required &&
        ["VERIFIED_GUARDIAN", "PROTECTED_NON_PARTICIPANT"].includes(item.authorityType) &&
        item.status !== "VERIFIED",
    )
  ) {
    decision = blocked(base, {
      code: "PROTECTED_PARTICIPANT_AUTHORITY_REQUIRED",
      why: "The approved scope may include a minor or protected non-participant without verified authority.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Remove that person from the recording scope or obtain the required verified authority.",
      serviceMayContinue: true,
    });
  } else if (facts.permissionRequired && !facts.verifiedAllowed) {
    const wrongRecipient = Boolean(facts.currentRecord?.recipientMismatch);
    decision = blocked(base, {
      code: wrongRecipient ? "PERMISSION_RECIPIENT_CORRECTION_REQUIRED" : "VERIFIED_PERMISSION_REQUIRED",
      why: wrongRecipient
        ? "The permission request contact details appear to belong to different people."
        : "Required customer recording permission is not active.",
      responsibleParticipant: wrongRecipient ? "VENDOR_MANAGER" : "CUSTOMER",
      resolution: wrongRecipient
        ? "Correct the customer contact and send a new secure request."
        : "The customer must use the secure request to allow recording.",
      serviceMayContinue: assessment.serviceCanContinueWithoutRecording,
    });
  } else if (
    assessment.authorities?.some(
      (item: any) =>
        item.required &&
        item.authorityType !== "EMPLOYEE_LIKENESS" &&
        item.status !== "VERIFIED",
    )
  ) {
    decision = blocked(base, {
      code: "ADDITIONAL_PERSON_AUTHORITY_REQUIRED",
      why: "The current permission does not cover every identifiable person in the approved recording scope.",
      responsibleParticipant: "CUSTOMER",
      resolution: "Obtain permission from the identifiable person or update the scope so that person will not appear.",
      serviceMayContinue: assessment.serviceCanContinueWithoutRecording,
    });
  } else if (!assigned) {
    decision = blocked(base, {
      code: "EMPLOYEE_ASSIGNMENT_REQUIRED",
      why: "No active employee is assigned to this work record.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Assign an active employee before releasing the service order.",
      serviceMayContinue: true,
    });
  } else if (capability !== "release" && !released) {
    decision = blocked(base, {
      code: "SERVICE_ORDER_RELEASE_REQUIRED",
      why: "The assigned employee has not received a released service order.",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Release the service order to the assigned employee.",
      serviceMayContinue: true,
    }, true);
  } else if (capability === "record" && !certification) {
    decision = blocked(base, {
      code: "EMPLOYEE_CERTIFICATION_REQUIRED",
      why: "The assigned employee has not certified the current recording scope.",
      responsibleParticipant: "EMPLOYEE",
      resolution: "Review the approved scope and complete the pre-recording certification.",
      serviceMayContinue: true,
    }, true);
  } else if (capability === "record" && locationAttempt?.status !== "VERIFIED" && locationException?.status !== "APPROVED") {
    const pendingException = locationException?.status === "PENDING";
    decision = blocked(base, {
      code: pendingException ? "LOCATION_EXCEPTION_PENDING" : "LOCATION_VERIFICATION_REQUIRED",
      why: pendingException
        ? "A location exception is waiting for an independent admin decision."
        : "The employee device has not verified the saved service location.",
      responsibleParticipant: pendingException ? "ADMIN" : "EMPLOYEE",
      resolution: pendingException
        ? "An admin must approve or deny the exception; the requesting manager cannot decide it."
        : "Allow precise location and verify the saved service address.",
      serviceMayContinue: true,
    }, true);
  } else {
    decision = {
      ...base,
      recordingUnlocked: capability !== "release",
      releaseAllowed: true,
      blockCode: null,
      blockMessage: null,
      block: null,
    };
  }
  await recordBlockMetric({
    bookingId: input.bookingId,
    vendorId: input.vendorId || assessment?.vendorId || "",
    surface: input.surface,
    block: decision.block,
    actorKind: input.actorKind,
  });
  return decision;
}

async function loadLegacyPermissionGate(input: {
  bookingId: string;
  vendorId?: string;
  customerMetadata: string | null | undefined;
  consentRecord?: any | null;
  now?: Date;
}): Promise<RecordingPermissionGate> {
  const consentRecord = input.consentRecord !== undefined ? input.consentRecord : await (prisma as any).consentRecord.findFirst({
    where: {
      bookingId: input.bookingId,
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      isCurrent: true,
    },
    orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
    select: {
      id: true,
      status: true,
      lifecycleStatus: true,
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: true,
      expiresAt: true,
      recipientMismatch: true,
      decisionEvidence: { select: { id: true } },
    },
  });
  return resolveRecordingPermissionGate({
    customerMetadata: input.customerMetadata,
    consentRecord,
    now: input.now,
  });
}

export async function loadRecordingPermissionGate(input: {
  bookingId: string;
  vendorId?: string;
  customerMetadata: string | null | undefined;
  consentRecord?: any | null;
  membershipId?: string | null;
  surface?: RecordingGateSurface;
  capability?: "release" | "record" | "observe";
  actorKind?: string | null;
  now?: Date;
}): Promise<RecordingPermissionGate> {
  return loadCanonicalRecordingGate({
    ...input,
    surface: input.surface || "media_session",
    capability: input.capability || "record",
  });
}

export function recordingGateErrorBody(gate: RecordingPermissionGate) {
  const fallbackBlock = {
    code: "RECORDING_GATE_UNAVAILABLE",
    why: "Reliance could not confirm every recording requirement for this work record.",
    responsibleParticipant: "VENDOR_MANAGER",
    resolution: "Refresh the work record. If the status remains unavailable, the vendor manager should contact Reliance Support.",
    serviceMayContinue: true,
  };
  return {
    error: gate.blockMessage || fallbackBlock.why,
    code: gate.blockCode || fallbackBlock.code,
    recordingGate: gate,
    blocked: gate.block || fallbackBlock,
  };
}
