import { createHash } from "node:crypto";
import { stableJson } from "@/lib/consent/content-version";
import {
  normalizeRecordingLocationChoice,
  type RecordingLocationChoice,
} from "@/lib/job-assignment";

export type RecordingPropertyScope = "vendor_owned" | "customer_owned" | "mixed";
export type RecordingPeopleScope = "none" | "customer" | "employee" | "multiple";
export type RecordingFrameControl = "controlled" | "partial" | "uncontrolled";
export type RecordingAuthorityHolder =
  | "customer"
  | "authorized_representative"
  | "guardian"
  | "vendor_manager";

export type RecordingScopeAssessmentInput = {
  recordingLocation: RecordingLocationChoice;
  propertyScope: RecordingPropertyScope;
  peopleScope: RecordingPeopleScope;
  frameControl: RecordingFrameControl;
  minorMayAppear: boolean;
  protectedNonParticipantMayAppear: boolean;
  sensitiveInformationMayAppear: boolean;
  identifiersMayAppear: boolean;
  residenceInterior: boolean;
  businessInterior: boolean;
  audioRequested: boolean;
  authorityHolderType: RecordingAuthorityHolder;
  serviceCanContinueWithoutRecording: boolean;
  essentialPrivateRecording: boolean;
};

export type DerivedRecordingScopeAssessment = RecordingScopeAssessmentInput & {
  riskLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";
  permissionRequired: boolean;
  noticeRequired: true;
  audioAllowed: false;
  scopeHash: string;
  subjectJson: string;
  scopeJson: string;
  authorityRequirements: Array<{
    authorityType: string;
    status: "VERIFIED" | "PENDING";
    required: boolean;
  }>;
};

function bool(value: unknown): boolean {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = String(value || "").trim().toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : null;
}

export function parseRecordingScopeAssessmentInput(
  source: Record<string, unknown>,
): RecordingScopeAssessmentInput | null {
  const location = normalizeRecordingLocationChoice(
    source.recordingLocation ?? source.vendor_job_recording_location,
  );
  const propertyScope = oneOf(source.propertyScope ?? source.recording_property_scope, [
    "vendor_owned",
    "customer_owned",
    "mixed",
  ] as const);
  const peopleScope = oneOf(source.peopleScope ?? source.recording_people_scope, [
    "none",
    "customer",
    "employee",
    "multiple",
  ] as const);
  const frameControl = oneOf(source.frameControl ?? source.recording_frame_control, [
    "controlled",
    "partial",
    "uncontrolled",
  ] as const);
  const authorityHolderType = oneOf(
    source.authorityHolderType ?? source.recording_authority_holder_type,
    ["customer", "authorized_representative", "guardian", "vendor_manager"] as const,
  );
  if (!location || !propertyScope || !peopleScope || !frameControl || !authorityHolderType) {
    return null;
  }
  return {
    recordingLocation: location,
    propertyScope,
    peopleScope,
    frameControl,
    minorMayAppear: bool(source.minorMayAppear ?? source.recording_minor_may_appear),
    protectedNonParticipantMayAppear: bool(
      source.protectedNonParticipantMayAppear ??
        source.recording_protected_non_participant_may_appear,
    ),
    sensitiveInformationMayAppear: bool(
      source.sensitiveInformationMayAppear ?? source.recording_sensitive_information_may_appear,
    ),
    identifiersMayAppear: bool(
      source.identifiersMayAppear ?? source.recording_identifiers_may_appear,
    ),
    residenceInterior: bool(source.residenceInterior ?? source.recording_residence_interior),
    businessInterior: bool(source.businessInterior ?? source.recording_business_interior),
    // Epic 4 keeps audio disabled even if a future client sends a true value.
    audioRequested: false,
    authorityHolderType,
    serviceCanContinueWithoutRecording: bool(
      source.serviceCanContinueWithoutRecording ??
        source.service_can_continue_without_recording,
    ),
    essentialPrivateRecording: bool(
      source.essentialPrivateRecording ?? source.essential_private_recording,
    ),
  };
}

export function deriveRecordingScopeAssessment(
  input: RecordingScopeAssessmentInput,
): DerivedRecordingScopeAssessment {
  const level4 =
    input.minorMayAppear ||
    input.protectedNonParticipantMayAppear ||
    input.frameControl === "uncontrolled";
  const level3 =
    input.peopleScope !== "none" ||
    input.sensitiveInformationMayAppear ||
    input.identifiersMayAppear;
  const level2 =
    input.propertyScope !== "vendor_owned" ||
    input.residenceInterior ||
    input.businessInterior ||
    input.frameControl === "partial";
  const riskLevel = level4
    ? "LEVEL_4"
    : level3
      ? "LEVEL_3"
      : level2
        ? "LEVEL_2"
        : "LEVEL_1";
  const permissionRequired =
    input.recordingLocation === "residence" ||
    input.recordingLocation === "customer-business" ||
    input.propertyScope !== "vendor_owned" ||
    input.peopleScope === "customer" ||
    input.peopleScope === "multiple" ||
    input.minorMayAppear ||
    input.protectedNonParticipantMayAppear ||
    input.sensitiveInformationMayAppear ||
    input.identifiersMayAppear;
  const subject = {
    propertyScope: input.propertyScope,
    peopleScope: input.peopleScope,
    frameControl: input.frameControl,
    minorMayAppear: input.minorMayAppear,
    protectedNonParticipantMayAppear: input.protectedNonParticipantMayAppear,
    sensitiveInformationMayAppear: input.sensitiveInformationMayAppear,
    identifiersMayAppear: input.identifiersMayAppear,
    residenceInterior: input.residenceInterior,
    businessInterior: input.businessInterior,
  };
  const scope = {
    schemaVersion: "recording-assessment-v1",
    recordingLocation: input.recordingLocation,
    subject,
    audioEnabled: false,
    initialAudience: "private",
    publicSharingIncluded: false,
    serviceCanContinueWithoutRecording: input.serviceCanContinueWithoutRecording,
    essentialPrivateRecording: input.essentialPrivateRecording,
    authorityHolderType: input.authorityHolderType,
  };
  const subjectJson = stableJson(subject);
  const scopeJson = stableJson(scope);
  const scopeHash = createHash("sha256").update(scopeJson).digest("hex");
  const authorities = new Map<string, "VERIFIED" | "PENDING">([
    ["VENDOR_MANAGER", "VERIFIED"],
  ]);
  if (permissionRequired) authorities.set("CUSTOMER_OR_REPRESENTATIVE", "PENDING");
  if (input.peopleScope === "customer" || input.peopleScope === "multiple") {
    authorities.set("CUSTOMER_LIKENESS", "PENDING");
  }
  if (input.peopleScope === "employee" || input.peopleScope === "multiple") {
    authorities.set("EMPLOYEE_LIKENESS", "PENDING");
  }
  if (input.minorMayAppear) authorities.set("VERIFIED_GUARDIAN", "PENDING");
  if (input.protectedNonParticipantMayAppear) {
    authorities.set("PROTECTED_NON_PARTICIPANT", "PENDING");
  }
  return {
    ...input,
    riskLevel,
    permissionRequired,
    noticeRequired: true,
    audioAllowed: false,
    scopeHash,
    subjectJson,
    scopeJson,
    authorityRequirements: Array.from(authorities, ([authorityType, status]) => ({
      authorityType,
      status,
      required: true,
    })),
  };
}

export async function createRecordingScopeAssessment(input: {
  tx: any;
  bookingId: string;
  vendorId: string;
  completedByUserId: string;
  assessment: DerivedRecordingScopeAssessment;
  generation?: number;
}) {
  const generation = input.generation ?? 1;
  const created = await input.tx.recordingScopeAssessment.create({
    data: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      generation,
      isCurrent: true,
      status: "COMPLETE",
      locationType: input.assessment.recordingLocation,
      riskLevel: input.assessment.riskLevel,
      propertyScope: input.assessment.propertyScope,
      peopleScope: input.assessment.peopleScope,
      frameControl: input.assessment.frameControl,
      subjectJson: input.assessment.subjectJson,
      scopeJson: input.assessment.scopeJson,
      scopeHash: input.assessment.scopeHash,
      audioRequested: false,
      audioAllowed: false,
      permissionRequired: input.assessment.permissionRequired,
      noticeRequired: true,
      serviceCanContinueWithoutRecording:
        input.assessment.serviceCanContinueWithoutRecording,
      essentialPrivateRecording: input.assessment.essentialPrivateRecording,
      authorityHolderType: input.assessment.authorityHolderType,
      completedByUserId: input.completedByUserId,
    },
  });
  await input.tx.recordingAuthorityRequirement.createMany({
    data: input.assessment.authorityRequirements.map((requirement) => ({
      assessmentId: created.id,
      ...requirement,
      actorUserId:
        requirement.authorityType === "VENDOR_MANAGER" ? input.completedByUserId : null,
      verifiedAt: requirement.status === "VERIFIED" ? new Date() : null,
    })),
  });
  return created;
}
