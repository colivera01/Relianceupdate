import { randomUUID } from "node:crypto";

import { stableJson } from "@/lib/consent/content-version";
import { hashOpaqueSecret } from "@/lib/consent/token";
import {
  consumeEmployeeDecisionSession,
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
  type EmployeeDecisionContext,
} from "@/lib/employee-decision-verification";
import { parseAssignmentMetadata, parseCustomerMetadata } from "@/lib/job-assignment";
import { interpretRecordingAssessment } from "@/lib/recording/assessment-reader";

export const EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION =
  "employee-recording-participation-v1";
export const EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION =
  "employee-recording-participation-v1-counsel-review-required";

export const EMPLOYEE_RECORDING_PARTICIPATION_TEXT = {
  ALLOW:
    "I allow Reliance to intentionally record me for this Work Record within the recording scope, boundary, participants, and audio setting shown. This does not authorize Public use.",
  DECLINE:
    "I do not allow Reliance to intentionally record me for this Work Record. Recording that includes me will remain blocked. This does not automatically cancel the service.",
} as const;

export type EmployeeRecordingParticipationDecisionValue = "ALLOW" | "DECLINE";

export type EmployeeParticipationEvidence = {
  membershipId: string;
  membershipGeneration: number;
  decisionId: string;
  decisionEvidenceHash: string;
  decisionVersion: number;
  assignmentGeneration: number;
  assessmentGeneration: number;
};

export type EmployeeRecordingParticipationResolution = {
  required: boolean;
  contractVersion: string | null;
  complete: boolean;
  status: "NOT_REQUIRED" | "ALLOWED" | "REQUIRED" | "DECLINED" | "STALE";
  evidence: EmployeeParticipationEvidence[];
  requiredMembershipIds: string[];
  missingMembershipIds: string[];
  declinedMembershipIds: string[];
  staleMembershipIds: string[];
  inactiveMembershipIds: string[];
};

export function employeeRecordingParticipationContractEnabled(
  customerMetadata: string | null | undefined,
): boolean {
  const metadata = parseCustomerMetadata(customerMetadata);
  return (
    metadata.vendor_job_employee_recording_participation_contract_version ===
    EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION
  );
}

export function assessmentIntentionallyIncludesAssignedEmployee(assessment: any): boolean {
  const interpretation = interpretRecordingAssessment(assessment);
  if (interpretation.kind === "SIMPLIFIED_V1") {
    return [
      "assigned_service_professional",
      "customer_and_assigned_service_professional",
    ].includes(interpretation.canonical.intentionalParticipantPlan);
  }
  if (interpretation.kind === "V2") {
    return interpretation.canonical.assessment.expectedPeople.includes(
      "ASSIGNED_SERVICE_PROFESSIONAL",
    );
  }
  return false;
}

function decisionDocument(input: {
  id: string;
  context: EmployeeDecisionContext;
  decision: EmployeeRecordingParticipationDecisionValue;
  consentTextSnapshot: string;
  consentTextHash: string;
  verificationSessionId: string;
  verifiedContactHash: string;
  verifiedChannel: string;
  ipAddress: string | null;
  userAgent: string | null;
  version: number;
  capturedMediaAffected: boolean;
  decidedAt: Date;
}) {
  return {
    evidenceVersion: 1,
    id: input.id,
    userId: input.context.userId,
    vendorId: input.context.vendorId,
    membershipId: input.context.membershipId,
    membershipGeneration: input.context.membershipGeneration,
    bookingId: input.context.bookingId,
    assignmentGeneration: input.context.assignmentGeneration,
    assessmentId: input.context.assessmentId,
    assessmentGeneration: input.context.assessmentGeneration,
    scopeHash: input.context.scopeHash,
    audioAllowed: input.context.audioAllowed,
    recordingBoundary: input.context.recordingBoundary,
    participantPlan: input.context.participantPlan,
    decision: input.decision,
    policyVersion: EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION,
    contractVersion: 1,
    consentTextSnapshot: input.consentTextSnapshot,
    consentTextHash: input.consentTextHash,
    verificationSessionId: input.verificationSessionId,
    verifiedContactHash: input.verifiedContactHash,
    verifiedChannel: input.verifiedChannel,
    verificationMethod: `${input.verifiedChannel}_otp`,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    version: input.version,
    capturedMediaAffected: input.capturedMediaAffected,
    decidedAt: input.decidedAt.toISOString(),
  };
}

export function employeeRecordingParticipationEvidenceHashValid(row: any): boolean {
  if (!row || Number(row.contractVersion || 0) !== 1) return false;
  const consentText = EMPLOYEE_RECORDING_PARTICIPATION_TEXT[
    String(row.decision || "") as EmployeeRecordingParticipationDecisionValue
  ];
  if (!consentText || row.consentTextSnapshot !== consentText) return false;
  if (hashOpaqueSecret(consentText) !== row.consentTextHash) return false;
  const decidedAt = new Date(row.decidedAt);
  if (Number.isNaN(decidedAt.getTime())) return false;
  const document = decisionDocument({
    id: row.id,
    context: {
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      userId: row.userId,
      vendorId: row.vendorId,
      membershipId: row.membershipId,
      membershipGeneration: Number(row.membershipGeneration),
      bookingId: row.bookingId,
      assignmentGeneration: Number(row.assignmentGeneration),
      assessmentId: row.assessmentId,
      assessmentGeneration: Number(row.assessmentGeneration),
      scopeHash: row.scopeHash,
      audioAllowed: row.audioAllowed,
      recordingBoundary: row.recordingBoundary,
      participantPlan: row.participantPlan,
      contextHash: "",
      employeeName: "",
      vendorName: "",
      serviceName: null,
      recipient: buildEmptyRecipient(),
    },
    decision: row.decision,
    consentTextSnapshot: row.consentTextSnapshot,
    consentTextHash: row.consentTextHash,
    verificationSessionId: row.verificationSessionId,
    verifiedContactHash: row.verifiedContactHash,
    verifiedChannel: row.verifiedChannel,
    ipAddress: row.ipAddress || null,
    userAgent: row.userAgent || null,
    version: Number(row.version),
    capturedMediaAffected: row.capturedMediaAffected === true,
    decidedAt,
  });
  return hashOpaqueSecret(stableJson(document)) === row.evidenceHash;
}

function buildEmptyRecipient(): EmployeeDecisionContext["recipient"] {
  return {
    name: null,
    email: null,
    phone: null,
    emailHash: null,
    phoneHash: null,
    emailMasked: null,
    phoneMasked: null,
  };
}

function rowMatchesContext(row: any, context: EmployeeDecisionContext): boolean {
  return (
    row.isCurrent === true &&
    !row.supersededAt &&
    !row.invalidatedAt &&
    row.userId === context.userId &&
    row.vendorId === context.vendorId &&
    row.membershipId === context.membershipId &&
    Number(row.membershipGeneration) === context.membershipGeneration &&
    row.bookingId === context.bookingId &&
    Number(row.assignmentGeneration) === context.assignmentGeneration &&
    row.assessmentId === context.assessmentId &&
    Number(row.assessmentGeneration) === context.assessmentGeneration &&
    row.scopeHash === context.scopeHash &&
    row.audioAllowed === context.audioAllowed &&
    row.recordingBoundary === context.recordingBoundary &&
    row.participantPlan === context.participantPlan &&
    row.policyVersion === EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION &&
    employeeRecordingParticipationEvidenceHashValid(row)
  );
}

export async function resolveEmployeeRecordingParticipation(input: {
  db: any;
  bookingId: string;
  vendorId: string;
  customerMetadata: string | null | undefined;
  assessment: any | null;
}): Promise<EmployeeRecordingParticipationResolution> {
  const enabled = employeeRecordingParticipationContractEnabled(input.customerMetadata);
  if (!enabled || !input.assessment || !assessmentIntentionallyIncludesAssignedEmployee(input.assessment)) {
    return {
      required: false,
      contractVersion: enabled ? EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION : null,
      complete: true,
      status: "NOT_REQUIRED",
      evidence: [],
      requiredMembershipIds: [],
      missingMembershipIds: [],
      declinedMembershipIds: [],
      staleMembershipIds: [],
      inactiveMembershipIds: [],
    };
  }
  const assignment = parseAssignmentMetadata(input.customerMetadata);
  const metadata = parseCustomerMetadata(input.customerMetadata);
  const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);
  const memberships = assignment.assignedMembershipIds.length
    ? await input.db.vendorMembership.findMany({
        where: { id: { in: assignment.assignedMembershipIds } },
        select: {
          id: true,
          userId: true,
          vendorId: true,
          role: true,
          status: true,
          membershipGeneration: true,
        },
      })
    : [];
  const requiredMemberships = memberships.filter(
    (row: any) =>
      row.vendorId === input.vendorId &&
      String(row.role || "").toUpperCase() === "EMPLOYEE" &&
      String(row.status || "").toUpperCase() === "ACTIVE",
  );
  const inactiveMembershipIds = assignment.assignedMembershipIds.filter(
    (membershipId) => !requiredMemberships.some((row: any) => row.id === membershipId),
  );
  const decisions = requiredMemberships.length
    ? await input.db.employeeRecordingParticipationDecision.findMany({
        where: {
          bookingId: input.bookingId,
          membershipId: { in: requiredMemberships.map((row: any) => row.id) },
          isCurrent: true,
        },
        orderBy: [{ version: "desc" }, { decidedAt: "desc" }],
      })
    : [];
  const evidence: EmployeeParticipationEvidence[] = [];
  const missingMembershipIds: string[] = [];
  const declinedMembershipIds: string[] = [];
  const staleMembershipIds: string[] = [];
  for (const membership of requiredMemberships) {
    const context = await loadEmployeeDecisionContext({
      db: input.db,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      userId: membership.userId,
      membershipId: membership.id,
      bookingId: input.bookingId,
    });
    const decision = decisions.find((row: any) => row.membershipId === membership.id) || null;
    if (!decision) {
      missingMembershipIds.push(membership.id);
      continue;
    }
    if (!rowMatchesContext(decision, context)) {
      staleMembershipIds.push(membership.id);
      continue;
    }
    if (decision.decision !== "ALLOW") {
      declinedMembershipIds.push(membership.id);
      continue;
    }
    evidence.push({
      membershipId: membership.id,
      membershipGeneration: context.membershipGeneration,
      decisionId: decision.id,
      decisionEvidenceHash: decision.evidenceHash,
      decisionVersion: Number(decision.version),
      assignmentGeneration,
      assessmentGeneration: Number(input.assessment.generation),
    });
  }
  evidence.sort((left, right) => left.membershipId.localeCompare(right.membershipId));
  const complete =
    requiredMemberships.length > 0 &&
    evidence.length === requiredMemberships.length &&
    inactiveMembershipIds.length === 0;
  return {
    required: true,
    contractVersion: EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION,
    complete,
    status: complete
      ? "ALLOWED"
      : declinedMembershipIds.length
        ? "DECLINED"
        : staleMembershipIds.length || inactiveMembershipIds.length
          ? "STALE"
          : "REQUIRED",
    evidence,
    requiredMembershipIds: requiredMemberships.map((row: any) => row.id).sort(),
    missingMembershipIds,
    declinedMembershipIds,
    staleMembershipIds,
    inactiveMembershipIds,
  };
}

async function archivePreApprovalCapturedMedia(tx: any, bookingId: string, vendorId: string) {
  const grant = await tx.privateProofAccessGrant.findFirst({
    where: { bookingId, vendorId, status: "ACTIVE", revokedAt: null },
    select: { id: true },
  });
  if (grant) {
    const activeEligibility = await tx.publicServiceVideoEligibility.findMany({
      where: { bookingId, vendorId, status: "ACTIVE", invalidatedAt: null },
      select: { id: true, proposalId: true, mediaAssetId: true },
    });
    if (activeEligibility.length) {
      const now = new Date();
      const eligibilityIds = activeEligibility.map((row: any) => row.id);
      const proposalIds = Array.from(new Set(
        activeEligibility.map((row: any) => String(row.proposalId)),
      ));
      const assetIds = Array.from(new Set(
        activeEligibility.map((row: any) => String(row.mediaAssetId)),
      ));
      await tx.publicServiceVideoEligibility.updateMany({
        where: { id: { in: eligibilityIds } },
        data: {
          status: "INVALIDATED",
          invalidatedAt: now,
          invalidationReason: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED",
        },
      });
      await tx.mediaAsset.updateMany({
        where: { id: { in: assetIds } },
        data: { visibilityStatus: "customer_only", publicEligible: false },
      });
      const proposals = await tx.serviceVideoPublicationProposal.findMany({
        where: { id: { in: proposalIds } },
        select: { packageVisibilityDecisionId: true },
      });
      await tx.serviceVideoPublicationProposal.updateMany({
        where: { id: { in: proposalIds } },
        data: {
          status: "DECLINED_PRIVATE",
          isCurrent: false,
          supersededAt: now,
        },
      });
      const visibilityDecisionIds = proposals
        .map((row: any) => row.packageVisibilityDecisionId)
        .filter(Boolean);
      if (visibilityDecisionIds.length) {
        await tx.serviceVideoPackageVisibilityDecision.updateMany({
          where: { id: { in: visibilityDecisionIds }, isCurrent: true },
          data: { isCurrent: false, supersededAt: now },
        });
      }
    }
    return { privateProofReleased: true, affectedCount: 0 };
  }
  const stages = await tx.serviceVideoStageEvidence.findMany({
    where: { bookingId, vendorId, isCurrent: true },
    select: { id: true, mediaAssetId: true },
  });
  const sessions = await tx.mediaSession.findMany({
    where: { bookingId, vendorId, sessionType: "SERVICE_RECORD" },
    select: { id: true },
  });
  const sessionIds = sessions.map((row: any) => row.id);
  const assets = sessionIds.length
    ? await tx.mediaAsset.findMany({
        where: {
          mediaSessionId: { in: sessionIds },
          deletedAt: null,
          archiveStatus: "active",
        },
        select: { id: true },
      })
    : [];
  const affectedAssetIds = Array.from(new Set([
    ...stages.map((row: any) => String(row.mediaAssetId)),
    ...assets.map((row: any) => String(row.id)),
  ]));
  if (!stages.length && !affectedAssetIds.length) {
    return { privateProofReleased: false, affectedCount: 0 };
  }
  if (stages.length) {
    await tx.serviceVideoStageEvidence.updateMany({
      where: { id: { in: stages.map((row: any) => row.id) }, isCurrent: true },
      data: { isCurrent: false },
    });
  }
  if (affectedAssetIds.length) {
    await tx.mediaAsset.updateMany({
      where: { id: { in: affectedAssetIds } },
      data: {
        archiveStatus: "employee_participation_withdrawn",
        publicEligible: false,
        visibilityStatus: "private",
      },
    });
  }
  if (sessionIds.length) {
    await tx.mediaUploadAttempt.updateMany({
      where: {
        mediaSessionId: { in: sessionIds },
        state: { notIn: ["SAVED", "REJECTED"] },
      },
      data: {
        state: "REJECTED",
        failureCode: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED",
        failureMessage: "Employee recording participation changed after capture.",
        rejectedAt: new Date(),
      },
    });
  }
  await tx.serviceVideoPackageEvidence.updateMany({
    where: {
      bookingId,
      vendorId,
      isCurrent: true,
      status: { notIn: ["PRIVATE_APPROVED", "ADMIN_REJECTED"] },
    },
    data: {
      isCurrent: false,
      status: "EMPLOYEE_PARTICIPATION_DECLINED",
    },
  });
  return {
    privateProofReleased: false,
    affectedCount: Math.max(stages.length, affectedAssetIds.length),
  };
}

export async function decideEmployeeRecordingParticipation(input: {
  db: any;
  userId: string;
  membershipId: string;
  bookingId: string;
  decision: EmployeeRecordingParticipationDecisionValue;
  sessionSecret: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}) {
  const normalized = String(input.decision || "").trim().toUpperCase();
  if (!(["ALLOW", "DECLINE"] as string[]).includes(normalized)) {
    throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_DECISION_INVALID");
  }
  const decision = normalized as EmployeeRecordingParticipationDecisionValue;
  const context = await loadEmployeeDecisionContext({
    db: input.db,
    purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
    userId: input.userId,
    membershipId: input.membershipId,
    bookingId: input.bookingId,
  });
  const now = input.now || new Date();
  return input.db.$transaction(async (tx: any) => {
    const currentContext = await loadEmployeeDecisionContext({
      db: tx,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      userId: input.userId,
      membershipId: input.membershipId,
      bookingId: input.bookingId,
    });
    if (currentContext.contextHash !== context.contextHash) {
      throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_CONTEXT_STALE");
    }
    const id = randomUUID();
    const session = await consumeEmployeeDecisionSession({
      tx,
      secret: input.sessionSecret,
      context: currentContext,
      consumedByType: "EMPLOYEE_RECORDING_PARTICIPATION_DECISION",
      consumedById: id,
      now,
    });
    const latest = await tx.employeeRecordingParticipationDecision.findFirst({
      where: { bookingId: input.bookingId, membershipId: input.membershipId },
      orderBy: { version: "desc" },
    });
    const current = await tx.employeeRecordingParticipationDecision.findFirst({
      where: {
        bookingId: input.bookingId,
        membershipId: input.membershipId,
        isCurrent: true,
      },
      orderBy: { version: "desc" },
    });
    const currentStages = await tx.serviceVideoStageEvidence.count({
      where: { bookingId: input.bookingId, vendorId: currentContext.vendorId, isCurrent: true },
    });
    const activeCapturedMedia = await tx.mediaAsset.count({
      where: {
        vendorId: currentContext.vendorId,
        deletedAt: null,
        archiveStatus: "active",
        mediaSession: { bookingId: input.bookingId, sessionType: "SERVICE_RECORD" },
      },
    });
    if (decision === "ALLOW" && (currentStages > 0 || activeCapturedMedia > 0)) {
      throw new Error("EMPLOYEE_RECORDING_ALLOW_REQUIRES_RETAKE_BOUNDARY");
    }
    let capturedMediaAffected = false;
    let privateProofReleased = false;
    if (decision === "DECLINE" && (currentStages > 0 || activeCapturedMedia > 0)) {
      const result = await archivePreApprovalCapturedMedia(
        tx,
        input.bookingId,
        currentContext.vendorId,
      );
      capturedMediaAffected = result.affectedCount > 0 || result.privateProofReleased;
      privateProofReleased = result.privateProofReleased;
    }
    if (current) {
      await tx.employeeRecordingParticipationDecision.update({
        where: { id: current.id },
        data: { isCurrent: false, supersededAt: now },
      });
    }
    const version = Number(latest?.version || 0) + 1;
    const consentTextSnapshot = EMPLOYEE_RECORDING_PARTICIPATION_TEXT[decision];
    const consentTextHash = hashOpaqueSecret(consentTextSnapshot);
    const document = decisionDocument({
      id,
      context: currentContext,
      decision,
      consentTextSnapshot,
      consentTextHash,
      verificationSessionId: session.id,
      verifiedContactHash: session.verifiedContactHash,
      verifiedChannel: session.verifiedChannel,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      version,
      capturedMediaAffected,
      decidedAt: now,
    });
    const { evidenceVersion: _evidenceVersion, ...persistedDocument } = document;
    const created = await tx.employeeRecordingParticipationDecision.create({
      data: {
        ...persistedDocument,
        bookingId: String(currentContext.bookingId),
        assignmentGeneration: Number(currentContext.assignmentGeneration),
        assessmentId: String(currentContext.assessmentId),
        assessmentGeneration: Number(currentContext.assessmentGeneration),
        scopeHash: String(currentContext.scopeHash),
        audioAllowed: currentContext.audioAllowed === true,
        recordingBoundary: String(currentContext.recordingBoundary),
        participantPlan: String(currentContext.participantPlan),
        evidenceHash: hashOpaqueSecret(stableJson(document)),
        isCurrent: true,
      },
    });
    let vendorNotificationId: string | null = null;
    if (decision === "DECLINE") {
      const notification = await tx.bookingNotification.upsert({
        where: {
          bookingId_kind: {
            bookingId: input.bookingId,
            kind: `EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:${input.membershipId}:${version}`,
          },
        },
        update: {},
        create: {
          bookingId: input.bookingId,
          kind: `EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:${input.membershipId}:${version}`,
          status: "QUEUED",
          channelsJson: stableJson(["EMAIL", "SMS", "MANAGE_JOB_STATUS"]),
          idempotencyKey: `employee-recording-participation-declined:${created.id}`,
        },
      });
      vendorNotificationId = notification.id;
    }
    return {
      decision: created,
      capturedMediaAffected,
      privateProofReleased,
      vendorNotificationId,
    };
  }, { isolationLevel: "Serializable" });
}

export async function assertEmployeeParticipationEvidenceCurrent(input: {
  db: any;
  bookingId: string;
  vendorId: string;
  customerMetadata: string | null | undefined;
  assessment: any;
  storedEvidenceJson: string | null | undefined;
}) {
  const resolution = await resolveEmployeeRecordingParticipation({
    db: input.db,
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    customerMetadata: input.customerMetadata,
    assessment: input.assessment,
  });
  if (!resolution.required) return resolution;
  if (!resolution.complete) throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_STALE");
  let stored: unknown = null;
  try {
    stored = JSON.parse(String(input.storedEvidenceJson || ""));
  } catch {
    throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_EVIDENCE_INVALID");
  }
  if (stableJson(stored) !== stableJson(resolution.evidence)) {
    throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_EVIDENCE_STALE");
  }
  return resolution;
}
