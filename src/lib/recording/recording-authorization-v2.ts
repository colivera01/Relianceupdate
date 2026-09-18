import {
  loadCanonicalRecordingGate,
  type RecordingGateSurface,
  type RecordingStage,
} from "@/lib/consent/recording-gate";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "./assessment-v2";
import { isServiceOrderReleasedForCurrentContext } from "@/lib/job-assignment";

export const V2_RECORDING_AUTHORIZATION_CONTRACT_VERSION =
  "v2-recording-authorization-resolution-v1" as const;

export type V2RecordingAuthorizationResolution = {
  contractVersion: typeof V2_RECORDING_AUTHORIZATION_CONTRACT_VERSION;
  authorized: boolean;
  blockReasons: string[];
  context: {
    bookingId: string;
    vendorId: string;
    membershipId: string;
    assignmentGeneration: number | null;
    assessmentId: string | null;
    assessmentGeneration: number | null;
    scopeHash: string | null;
    stage: RecordingStage;
  };
  customer: {
    required: boolean;
    status: string;
    consentRecordId: string | null;
    decisionEvidenceId: string | null;
  };
  employees: {
    required: boolean;
    complete: boolean;
    status: string;
    requiredMembershipIds: string[];
    missingMembershipIds: string[];
    declinedMembershipIds: string[];
    staleMembershipIds: string[];
  };
  serviceOrderCurrent: boolean;
  runtimeGate: Awaited<ReturnType<typeof loadCanonicalRecordingGate>>;
};

export async function resolveCurrentV2RecordingAuthorization(input: {
  db: any;
  bookingId: string;
  vendorId: string;
  membershipId: string;
  stage: RecordingStage;
  surface: RecordingGateSurface;
  now?: Date;
}): Promise<V2RecordingAuthorizationResolution> {
  const booking = await input.db.booking.findFirst({
    where: { id: input.bookingId, vendorId: input.vendorId },
    select: { customerMetadata: true },
  });
  if (!booking) throw new Error("V2_RECORDING_WORK_RECORD_NOT_FOUND");

  const gate = await loadCanonicalRecordingGate({
    db: input.db,
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    customerMetadata: booking.customerMetadata,
    membershipId: input.membershipId,
    recordingStage: input.stage,
    surface: input.surface,
    capability: "record",
    actorKind: "EMPLOYEE",
    now: input.now,
  });
  if (gate.assessmentContractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    throw new Error("V2_RECORDING_ASSESSMENT_REQUIRED");
  }
  const serviceOrderCurrent = isServiceOrderReleasedForCurrentContext(
    booking.customerMetadata,
    {
      membershipId: input.membershipId,
      assignmentGeneration: Number(gate.assignmentGeneration),
      assessmentId: gate.assessmentId,
      assessmentGeneration: gate.assessmentGeneration,
      scopeHash: gate.scopeHash,
    },
  );
  const participation = gate.employeeParticipation;
  const blockReasons = gate.blockCode ? [gate.blockCode] : [];
  if (
    participation?.required &&
    participation.requiredMembershipIds.length > 1 &&
    !participation.complete &&
    !blockReasons.includes("MULTIPLE_EMPLOYEE_PARTICIPATION_REQUIRED")
  ) {
    blockReasons.push("MULTIPLE_EMPLOYEE_PARTICIPATION_REQUIRED");
  }
  return {
    contractVersion: V2_RECORDING_AUTHORIZATION_CONTRACT_VERSION,
    authorized: gate.recordingUnlocked && blockReasons.length === 0,
    blockReasons,
    context: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      assignmentGeneration: gate.assignmentGeneration,
      assessmentId: gate.assessmentId,
      assessmentGeneration: gate.assessmentGeneration,
      scopeHash: gate.scopeHash,
      stage: input.stage,
    },
    customer: {
      required: gate.permissionRequired,
      status: String(gate.permissionState),
      consentRecordId: gate.consentRecordId,
      decisionEvidenceId: gate.permissionDecisionEvidenceId,
    },
    employees: {
      required: participation?.required === true,
      complete: participation?.complete !== false,
      status: participation?.status || "NOT_REQUIRED",
      requiredMembershipIds: participation?.requiredMembershipIds || [],
      missingMembershipIds: participation?.missingMembershipIds || [],
      declinedMembershipIds: participation?.declinedMembershipIds || [],
      staleMembershipIds: participation?.staleMembershipIds || [],
    },
    serviceOrderCurrent,
    runtimeGate: gate,
  };
}
