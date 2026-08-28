import { createHash } from "node:crypto";

import { prisma } from "@/server/db";
import {
  normalizeRecordingLocationChoice,
  parseAssignmentMetadata,
  parseCustomerMetadata,
  validateRecordingLocationSnapshot,
  type RecordingLocationChoice,
} from "@/lib/job-assignment";

import {
  EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
  EMPLOYEE_RECORDING_SAFETY_ISSUES,
  employeeSafetyChainKey,
  parseEmployeeRecordingSafetyEvidence,
  requiredSafetyCheckForStage,
  storedSafetyEvidenceToCanonicalInput,
  type EmployeeRecordingSafetyCheckType,
  type EmployeeRecordingSafetyIssue,
  type EmployeeRecordingSafetyResult,
  type EmployeeRecordingSafetyStage,
  type StoredEmployeeRecordingSafetyEvidence,
} from "./employee-safety";
import {
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  stableJsonV2,
} from "./assessment-v2";
import { interpretRecordingAssessment } from "./assessment-reader";
import { validateV2SafetyLocationAttempt } from "./v2-safety-location";

export class EmployeeRecordingSafetyServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeRecordingSafetyServiceError";
  }
}

function fail(code: string, message: string): never {
  throw new EmployeeRecordingSafetyServiceError(code, message);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashRequestId(value: string): string {
  const requestId = String(value || "").trim();
  if (requestId.length < 16 || requestId.length > 191 || /[\u0000-\u001f\u007f]/.test(requestId)) {
    fail("V2_SAFETY_IDEMPOTENCY_KEY_INVALID", "A valid safety submission request ID is required.");
  }
  return sha256(requestId);
}

function canonicalSubmissionBody(input: {
  locationAttemptId: string;
  checkType: EmployeeRecordingSafetyCheckType;
  stage: EmployeeRecordingSafetyStage;
  result: EmployeeRecordingSafetyResult;
  issues: EmployeeRecordingSafetyIssue[];
}) {
  for (const issue of input.issues) {
    if (!EMPLOYEE_RECORDING_SAFETY_ISSUES.includes(issue)) {
      fail("V2_SAFETY_ISSUE_INVALID", "The safety submission contains an unsupported issue code.");
    }
  }
  if (new Set(input.issues).size !== input.issues.length) {
    fail("V2_SAFETY_ISSUE_INVALID", "The safety submission contains a duplicate issue code.");
  }
  const selected = new Set(input.issues);
  return stableJsonV2({
    locationAttemptId: input.locationAttemptId,
    checkType: input.checkType,
    stage: input.stage,
    result: input.result,
    issues: EMPLOYEE_RECORDING_SAFETY_ISSUES.filter((issue) => selected.has(issue)),
  });
}

function internalLocationType(value: string): RecordingLocationChoice {
  if (value === "VENDOR_BUSINESS") return "business";
  if (value === "CUSTOMER_RESIDENCE") return "residence";
  if (value === "CUSTOMER_BUSINESS") return "customer-business";
  return fail("V2_SAFETY_LOCATION_TYPE_INVALID", "The V2 recording location is invalid.");
}

function validateStoredPredecessor(row: StoredEmployeeRecordingSafetyEvidence) {
  const parsed = parseEmployeeRecordingSafetyEvidence(storedSafetyEvidenceToCanonicalInput(row));
  if (parsed.evidenceHash !== row.evidenceHash || parsed.canonicalJson !== row.canonicalJson) {
    fail("V2_SAFETY_PREDECESSOR_INVALID", "The existing safety evidence chain is invalid.");
  }
}

export async function loadLatestEmployeeRecordingSafetyEvidence(input: {
  bookingId: string;
  vendorId: string;
  assessmentId: string;
  membershipId: string;
  assignmentGeneration: number;
  locationSnapshotEvidenceHash: string;
  checkType: EmployeeRecordingSafetyCheckType;
  stage: EmployeeRecordingSafetyStage;
}): Promise<StoredEmployeeRecordingSafetyEvidence | null> {
  return (prisma as any).employeeRecordingSafetyEvidence.findFirst({
    where: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      assessmentId: input.assessmentId,
      membershipId: input.membershipId,
      assignmentGeneration: input.assignmentGeneration,
      locationSnapshotEvidenceHash: input.locationSnapshotEvidenceHash,
      safetyContractVersion: EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
      checkType: input.checkType,
      stage: input.stage,
    },
    orderBy: [{ sequence: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });
}

export async function appendEmployeeRecordingSafetyEvidence(input: {
  bookingId: string;
  vendorId: string;
  membershipId: string;
  locationAttemptId: string;
  requestId: string;
  checkType: EmployeeRecordingSafetyCheckType;
  stage: EmployeeRecordingSafetyStage;
  result: EmployeeRecordingSafetyResult;
  issues: EmployeeRecordingSafetyIssue[];
  now?: Date;
}) {
  const database = prisma as any;
  const submissionRequestHash = hashRequestId(input.requestId);
  const submissionBodyHash = sha256(canonicalSubmissionBody(input));

  const run = () => database.$transaction(
    async (tx: any) => {
      const [booking, assessment, membership] = await Promise.all([
        tx.booking.findFirst({
          where: { id: input.bookingId, vendorId: input.vendorId },
          select: { id: true, vendorId: true, customerMetadata: true },
        }),
        tx.recordingScopeAssessment.findFirst({
          where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
          orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
        }),
        tx.vendorMembership.findFirst({
          where: { id: input.membershipId, vendorId: input.vendorId, role: "EMPLOYEE", status: "ACTIVE" },
          select: { id: true, userId: true },
        }),
      ]);
      if (!booking) fail("V2_SAFETY_WORK_RECORD_NOT_FOUND", "The work record is unavailable.");
      if (!membership) fail("V2_SAFETY_EMPLOYEE_UNAUTHORIZED", "An active assigned employee is required.");
      if (
        !assessment ||
        assessment.status !== "COMPLETE" ||
        assessment.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION
      ) {
        fail("V2_SAFETY_ASSESSMENT_REQUIRED", "A current complete V2 assessment is required.");
      }

      let canonicalAssessment;
      try {
        const interpretation = interpretRecordingAssessment(assessment);
        if (interpretation.kind !== "V2") {
          return fail("V2_SAFETY_ASSESSMENT_REQUIRED", "A current complete V2 assessment is required.");
        }
        canonicalAssessment = interpretation.canonical;
      } catch {
        return fail("V2_SAFETY_ASSESSMENT_INVALID", "The current V2 assessment is invalid.");
      }
      if (
        canonicalAssessment.scopeHash !== assessment.scopeHash ||
        canonicalAssessment.assessment.derived.participantPolicyStatus !== "SUPPORTED"
      ) {
        fail(
          canonicalAssessment.assessment.derived.participantPolicyStatus === "SUPPORTED"
            ? "V2_SAFETY_ASSESSMENT_INVALID"
            : "V2_SAFETY_PLAN_CHANGE_REQUIRED",
          "The current V2 assessment cannot authorize a safety check.",
        );
      }

      const assignment = parseAssignmentMetadata(booking.customerMetadata);
      const metadata = parseCustomerMetadata(booking.customerMetadata);
      const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);
      if (
        !Number.isSafeInteger(assignmentGeneration) ||
        assignmentGeneration < 1 ||
        !assignment.assignedMembershipIds.includes(membership.id)
      ) {
        fail("V2_SAFETY_ASSIGNMENT_STALE", "The employee assignment is missing or stale.");
      }

      const expectedLocation = internalLocationType(canonicalAssessment.assessment.location.type);
      if (normalizeRecordingLocationChoice(assessment.locationType) !== expectedLocation) {
        fail("V2_SAFETY_LOCATION_BINDING_INVALID", "The assessment location binding is invalid.");
      }
      const location = validateRecordingLocationSnapshot(booking.customerMetadata, expectedLocation);
      if (
        !location.ok ||
        !location.snapshot.snapshotEvidenceHash ||
        location.snapshot.snapshotEvidenceHash !== canonicalAssessment.assessment.location.snapshotEvidenceHash
      ) {
        fail("V2_SAFETY_LOCATION_BINDING_INVALID", "The location evidence is missing or stale.");
      }

      const requirement = requiredSafetyCheckForStage(input.stage);
      if (!requirement || requirement.stage !== input.stage || requirement.checkType !== input.checkType) {
        fail("V2_SAFETY_CHECK_STAGE_MISMATCH", "The safety check does not match the stage.");
      }
      const chainKey = employeeSafetyChainKey({
        bookingId: booking.id,
        vendorId: input.vendorId,
        assessmentId: assessment.id,
        assessmentGeneration: assessment.generation,
        assessmentContractVersion: assessment.contractVersion,
        assessmentScopeHash: assessment.scopeHash,
        locationSnapshotEvidenceHash: location.snapshot.snapshotEvidenceHash,
        membershipId: membership.id,
        assignmentGeneration,
        checkType: input.checkType,
        stage: input.stage,
      });
      const existing = await tx.employeeRecordingSafetyEvidence.findFirst({
        where: { chainKey, submissionRequestHash },
      });
      if (existing) {
        if (existing.submissionBodyHash !== submissionBodyHash) {
          fail("V2_SAFETY_IDEMPOTENCY_CONFLICT", "The request ID was already used for different safety evidence.");
        }
        validateStoredPredecessor(existing);
        return existing;
      }
      const chainRows = (await tx.employeeRecordingSafetyEvidence.findMany({
        where: { chainKey },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      })) as StoredEmployeeRecordingSafetyEvidence[];
      for (let index = 0; index < chainRows.length; index += 1) {
        const row = chainRows[index];
        const prior = chainRows[index - 1];
        validateStoredPredecessor(row);
        if (
          (!prior && (row.sequence !== 1 || row.predecessorEvidenceId !== null || row.predecessorEvidenceHash !== null)) ||
          (prior && (row.sequence !== prior.sequence + 1 || row.predecessorEvidenceId !== prior.id || row.predecessorEvidenceHash !== prior.evidenceHash))
        ) {
          fail("V2_SAFETY_PREDECESSOR_INVALID", "The existing safety evidence chain is invalid.");
        }
      }
      if (chainRows.some((row) => row.result === "MATERIAL_SCOPE_CHANGE_REQUIRED")) {
        fail(
          "V2_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED",
          "A new assessment and permission chain is required before another safety check.",
        );
      }
      const locationAttempt = await validateV2SafetyLocationAttempt({
        tx,
        locationAttemptId: input.locationAttemptId,
        bookingId: booking.id,
        vendorId: input.vendorId,
        assessmentId: assessment.id,
        assessmentGeneration: assessment.generation,
        membershipId: membership.id,
        assignmentGeneration,
        stage: input.stage,
        snapshotEvidenceHash: location.snapshot.snapshotEvidenceHash,
        now: input.now,
      });
      const reusedLocationAttempt = await tx.employeeRecordingSafetyEvidence.findFirst({
        where: { locationAttemptId: locationAttempt.row.id },
      });
      if (reusedLocationAttempt) {
        if (
          reusedLocationAttempt.chainKey === chainKey &&
          reusedLocationAttempt.submissionRequestHash === submissionRequestHash &&
          reusedLocationAttempt.submissionBodyHash === submissionBodyHash
        ) {
          validateStoredPredecessor(reusedLocationAttempt);
          return reusedLocationAttempt;
        }
        fail(
          "V2_SAFETY_LOCATION_ATTEMPT_ALREADY_USED",
          "A fresh stage location attempt is required for each safety decision.",
        );
      }
      const predecessor = chainRows[chainRows.length - 1] || null;
      const createdAt = (input.now || new Date()).toISOString();
      const canonical = parseEmployeeRecordingSafetyEvidence({
        contractVersion: EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
        sequence: (predecessor?.sequence || 0) + 1,
        workRecord: { bookingId: booking.id, vendorId: input.vendorId },
        assessment: {
          id: assessment.id,
          generation: assessment.generation,
          contractVersion: assessment.contractVersion,
          scopeHash: assessment.scopeHash,
        },
        location: {
          snapshotEvidenceHash: location.snapshot.snapshotEvidenceHash,
          attemptId: locationAttempt.row.id,
          attemptEvidenceHash: locationAttempt.evidenceHash,
        },
        employee: { membershipId: membership.id, assignmentGeneration },
        check: { type: input.checkType, stage: input.stage },
        issues: input.issues,
        result: input.result,
        submission: { requestHash: submissionRequestHash, bodyHash: submissionBodyHash },
        predecessor: predecessor
          ? { id: predecessor.id, evidenceHash: predecessor.evidenceHash }
          : null,
        createdAt,
      });

      return tx.employeeRecordingSafetyEvidence.create({
        data: {
          bookingId: booking.id,
          vendorId: input.vendorId,
          assessmentId: assessment.id,
          assessmentGeneration: assessment.generation,
          assessmentContractVersion: assessment.contractVersion,
          assessmentScopeHash: assessment.scopeHash,
          locationSnapshotEvidenceHash: location.snapshot.snapshotEvidenceHash,
          locationAttemptId: locationAttempt.row.id,
          locationAttemptEvidenceHash: locationAttempt.evidenceHash,
          membershipId: membership.id,
          assignmentGeneration,
          safetyContractVersion: EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
          checkType: input.checkType,
          stage: input.stage,
          result: canonical.evidence.result,
          issueCodesJson: canonical.issueCodesJson,
          sequence: canonical.evidence.sequence,
          chainKey,
          predecessorEvidenceId: predecessor?.id || null,
          predecessorEvidenceHash: predecessor?.evidenceHash || null,
          submissionRequestHash,
          submissionBodyHash,
          canonicalJson: canonical.canonicalJson,
          evidenceHash: canonical.evidenceHash,
          createdAt: new Date(createdAt),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  try {
    return await run();
  } catch (error: any) {
    if (String(error?.code || "").toUpperCase() !== "P2002") throw error;
    return run();
  }
}
