import { parseAssignmentMetadata, parseCustomerMetadata, validateRecordingLocationSnapshot } from "@/lib/job-assignment";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  v2LocationToRecordingChoice,
  type RecordingAssessmentV2,
} from "./assessment-v2";

export const V2_ASSESSMENT_WRITER_RUNTIME_STATE = "DORMANT_NO_ORDINARY_ROUTE" as const;

const RETRYABLE_TRANSACTION_CODES = new Set(["P2002", "P2034"]);

export class RecordingAssessmentV2WriterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecordingAssessmentV2WriterError";
  }
}

function fail(code: string, message: string): never {
  throw new RecordingAssessmentV2WriterError(code, message);
}

export type ExpectedCurrentAssessment = {
  assessmentId: string;
  generation: number;
  scopeHash: string;
} | null;

function currentMatchesExpected(current: any | null, expected: ExpectedCurrentAssessment): boolean {
  if (!expected) return !current;
  return Boolean(
    current &&
      current.id === expected.assessmentId &&
      Number(current.generation) === expected.generation &&
      current.scopeHash === expected.scopeHash,
  );
}

function v2RiskLevel(assessment: RecordingAssessmentV2): "LEVEL_1" | "LEVEL_2" | "LEVEL_3" {
  if (
    assessment.recordingFormat === "VIDEO_AUDIO" ||
    assessment.expectedPeople.some((person) => person !== "NO_IDENTIFIABLE_PEOPLE")
  ) {
    return "LEVEL_3";
  }
  return assessment.location.type === "VENDOR_BUSINESS" &&
    assessment.recordingArea.boundary === "SERVICE_AREA_ONLY"
    ? "LEVEL_1"
    : "LEVEL_2";
}

function authorityRequirements(assessment: RecordingAssessmentV2, actorUserId: string, now: Date) {
  const requirements: Array<Record<string, unknown>> = [
    {
      authorityType: "VENDOR_MANAGER",
      status: "VERIFIED",
      required: true,
      actorUserId,
      verifiedAt: now,
    },
  ];
  if (assessment.derived.customerPermissionRequired) {
    requirements.push({
      authorityType: "CUSTOMER",
      status: "PENDING",
      required: true,
      actorUserId: null,
      verifiedAt: null,
    });
  }
  if (assessment.expectedPeople.includes("CUSTOMER")) {
    requirements.push({
      authorityType: "CUSTOMER_LIKENESS",
      status: "PENDING",
      required: true,
      actorUserId: null,
      verifiedAt: null,
    });
  }
  if (assessment.expectedPeople.includes("ASSIGNED_SERVICE_PROFESSIONAL")) {
    requirements.push({
      authorityType: "EMPLOYEE_LIKENESS",
      status: "PENDING",
      required: true,
      actorUserId: null,
      verifiedAt: null,
    });
  }
  return requirements;
}

function nextMetadata(input: {
  current: string | null | undefined;
  assessment: RecordingAssessmentV2;
  assessmentId: string;
  generation: number;
  scopeHash: string;
}) {
  const metadata = parseCustomerMetadata(input.current);
  metadata.vendor_job_recording_location = v2LocationToRecordingChoice(input.assessment.location.type);
  metadata.recording_assessment_contract_version = RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
  metadata.recording_assessment_id = input.assessmentId;
  metadata.recording_assessment_generation = input.generation;
  metadata.recording_assessment_scope_hash = input.scopeHash;
  metadata.recording_audio_requested = input.assessment.recordingFormat === "VIDEO_AUDIO";
  metadata.recording_boundary = input.assessment.recordingArea.boundary;
  metadata.recording_expected_people = input.assessment.expectedPeople;
  metadata.recording_intended_subjects = input.assessment.intendedSubjects;
  metadata.vendor_job_consent_status = input.assessment.derived.customerPermissionRequired
    ? "pending"
    : "not_required";
  delete metadata.vendor_job_consent_accepted;
  delete metadata.vendor_job_consent_verified;
  delete metadata.vendor_job_consent_decided_at;
  delete metadata.vendor_job_service_order_released_membership_ids;
  delete metadata.vendor_job_service_order_released_at;
  delete metadata.vendor_job_service_order_release_contexts;
  return JSON.stringify(metadata);
}

export async function writeRecordingAssessmentV2(input: {
  db: any;
  bookingId: string;
  vendorId: string;
  actorUserId: string;
  actorMembershipId: string;
  expectedAssignmentGeneration: number;
  expectedCurrent: ExpectedCurrentAssessment;
  proposal: unknown;
  now?: Date;
}) {
  const canonical = parseRecordingAssessmentV2(input.proposal);
  const now = input.now || new Date();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await input.db.$transaction(async (tx: any) => {
        const [booking, actor, current, latest] = await Promise.all([
          tx.booking.findFirst({
            where: { id: input.bookingId, vendorId: input.vendorId },
            select: { id: true, vendorId: true, customerMetadata: true },
          }),
          tx.vendorMembership.findFirst({
            where: {
              id: input.actorMembershipId,
              userId: input.actorUserId,
              vendorId: input.vendorId,
              role: { in: ["MANAGER", "manager"] },
              status: { in: ["ACTIVE", "active"] },
            },
            select: { id: true },
          }),
          tx.recordingScopeAssessment.findFirst({
            where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
            orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
          }),
          tx.recordingScopeAssessment.findFirst({
            where: { bookingId: input.bookingId, vendorId: input.vendorId },
            orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
            select: { generation: true },
          }),
        ]);
        if (!booking) fail("V2_ASSESSMENT_WORK_RECORD_NOT_FOUND", "The Work Record is unavailable.");
        if (!actor) fail("V2_ASSESSMENT_WRITER_FORBIDDEN", "An active Vendor Manager is required.");

        const assignmentGeneration = Number(
          parseCustomerMetadata(booking.customerMetadata).vendor_job_assignment_generation || 1,
        );
        if (
          !Number.isInteger(input.expectedAssignmentGeneration) ||
          input.expectedAssignmentGeneration < 1 ||
          assignmentGeneration !== input.expectedAssignmentGeneration
        ) {
          fail("V2_ASSESSMENT_ASSIGNMENT_STALE", "The Employee assignment changed before the assessment was saved.");
        }

        const locationType = v2LocationToRecordingChoice(canonical.assessment.location.type);
        const snapshot = validateRecordingLocationSnapshot(booking.customerMetadata, locationType);
        if (
          !snapshot.ok ||
          snapshot.snapshot.snapshotEvidenceHash !== canonical.assessment.location.snapshotEvidenceHash
        ) {
          fail("V2_ASSESSMENT_LOCATION_STALE", "The proposed recording location does not match the immutable Work Record location.");
        }

        if (
          current?.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION &&
          current.status === "COMPLETE" &&
          current.scopeHash === canonical.scopeHash &&
          current.scopeJson === canonical.scopeJson &&
          current.subjectJson === canonical.subjectJson
        ) {
          return { assessment: current, created: false, idempotent: true };
        }
        if (!currentMatchesExpected(current, input.expectedCurrent)) {
          fail("V2_ASSESSMENT_WRITER_STALE", "The current recording assessment changed before this request was saved.");
        }

        const generation = Number(latest?.generation || 0) + 1;
        if (current) {
          await tx.recordingScopeAssessment.updateMany({
            where: { id: current.id, isCurrent: true },
            data: { isCurrent: false, status: "SUPERSEDED", supersededAt: now },
          });
        }
        await tx.employeeRecordingCertification.updateMany({
          where: { bookingId: input.bookingId, status: "ACTIVE", invalidatedAt: null },
          data: {
            status: "INVALIDATED",
            invalidatedAt: now,
            invalidationReason: "RECORDING_ASSESSMENT_REPLACED",
          },
        });
        await tx.employeeRecordingParticipationDecision.updateMany({
          where: { bookingId: input.bookingId, isCurrent: true },
          data: {
            isCurrent: false,
            supersededAt: now,
            invalidatedAt: now,
            invalidationReason: "RECORDING_ASSESSMENT_REPLACED",
          },
        });

        const priorPermissions = await tx.consentRecord.findMany({
          where: { bookingId: input.bookingId, isCurrent: true },
          select: { id: true },
        });
        const priorPermissionIds = priorPermissions.map((row: any) => row.id);
        if (priorPermissionIds.length > 0) {
          await tx.consentRequestLink.updateMany({
            where: { consentRecordId: { in: priorPermissionIds }, revokedAt: null },
            data: { revokedAt: now, revocationReason: "recording_assessment_replaced" },
          });
          await tx.consentRecord.updateMany({
            where: { id: { in: priorPermissionIds }, isCurrent: true },
            data: {
              isCurrent: false,
              status: "superseded",
              lifecycleStatus: "SUPERSEDED",
              supersededAt: now,
            },
          });
          await tx.bookingNotification.updateMany({
            where: { consentRecordId: { in: priorPermissionIds }, deadLetteredAt: null },
            data: {
              status: "DEAD_LETTERED",
              deadLetteredAt: now,
              nextAttemptAt: null,
              lastError: "superseded_by_recording_assessment_replacement",
            },
          });
        }

        const assessment = await tx.recordingScopeAssessment.create({
          data: {
            bookingId: input.bookingId,
            vendorId: input.vendorId,
            generation,
            isCurrent: true,
            status: "COMPLETE",
            contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
            locationType,
            riskLevel: v2RiskLevel(canonical.assessment),
            propertyScope: canonical.assessment.location.type,
            peopleScope: canonical.assessment.expectedPeople.join(","),
            frameControl: canonical.assessment.recordingArea.boundary,
            subjectJson: canonical.subjectJson,
            scopeJson: canonical.scopeJson,
            scopeHash: canonical.scopeHash,
            audioRequested: canonical.assessment.recordingFormat === "VIDEO_AUDIO",
            audioAllowed: canonical.assessment.recordingFormat === "VIDEO_AUDIO",
            permissionRequired: canonical.assessment.derived.customerPermissionRequired,
            noticeRequired: true,
            serviceCanContinueWithoutRecording: true,
            essentialPrivateRecording: false,
            authorityHolderType: canonical.assessment.derived.expectedAuthority,
            completedByUserId: input.actorUserId,
            completedAt: now,
          },
        });
        await tx.recordingAuthorityRequirement.createMany({
          data: authorityRequirements(canonical.assessment, input.actorUserId, now).map(
            (requirement) => ({ assessmentId: assessment.id, ...requirement }),
          ),
        });
        if (priorPermissionIds.length > 0) {
          await Promise.all(priorPermissionIds.map((consentRecordId: string) =>
            tx.consentEvent.create({
              data: {
                consentRecordId,
                eventType: "assessment_superseded",
                metadata: JSON.stringify({
                  previousAssessmentId: current?.id || null,
                  previousAssessmentGeneration: current?.generation || null,
                  previousScopeHash: current?.scopeHash || null,
                  nextAssessmentId: assessment.id,
                  nextAssessmentGeneration: generation,
                  nextScopeHash: canonical.scopeHash,
                }),
              },
            }),
          ));
        }
        await tx.booking.update({
          where: { id: input.bookingId },
          data: {
            customerMetadata: nextMetadata({
              current: booking.customerMetadata,
              assessment: canonical.assessment,
              assessmentId: assessment.id,
              generation,
              scopeHash: canonical.scopeHash,
            }),
          },
        });
        return { assessment, created: true, idempotent: false };
      }, { isolationLevel: "Serializable" });
    } catch (error: any) {
      if (!RETRYABLE_TRANSACTION_CODES.has(String(error?.code || "")) || attempt === 2) {
        throw error;
      }
    }
  }
  return fail("V2_ASSESSMENT_CONCURRENCY_RETRY_EXHAUSTED", "The assessment could not be serialized.");
}
