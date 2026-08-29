import { createHash } from "node:crypto";

import { stableJson } from "@/lib/consent/content-version";
import {
  normalizeRecordingLocationChoice,
  type RecordingLocationChoice,
} from "@/lib/job-assignment";

export type RecordingAuthorityHolder = "customer" | "vendor_manager";
export type IntentionalParticipantPlan =
  | "none"
  | "customer"
  | "assigned_service_professional"
  | "customer_and_assigned_service_professional";
export type DerivedSiteControl =
  | "customer_controlled_residence"
  | "customer_controlled_business_location"
  | "vendor_controlled_business_location";

export type RecordingScopeAssessmentInput = {
  recordingLocation: RecordingLocationChoice;
  intentionalParticipantPlan: IntentionalParticipantPlan;
  audioRequested: boolean;
};

export type RecordingScopeAssessmentContext = {
  locationSnapshotEvidenceHash: string;
  generation: number;
  completedByUserId: string;
  completedAt: Date;
};

export type DerivedRecordingScopeAssessment = RecordingScopeAssessmentInput & {
  contractVersion: typeof SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION;
  siteControl: DerivedSiteControl;
  recordingBoundary: typeof SIMPLIFIED_V1_RECORDING_BOUNDARY;
  prohibitedConditions: readonly string[];
  locationSnapshotEvidenceHash: string;
  generation: number;
  completedByUserId: string;
  completedAt: Date;
  authorityHolderType: RecordingAuthorityHolder;
  riskLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
  permissionRequired: boolean;
  noticeRequired: true;
  audioAllowed: boolean;
  serviceCanContinueWithoutRecording: false;
  essentialPrivateRecording: true;
  scopeHash: string;
  subjectJson: string;
  scopeJson: string;
  authorityRequirements: Array<{
    authorityType: string;
    status: "VERIFIED" | "PENDING";
    required: boolean;
  }>;
};

/** Historical NULL-contract rows use this schema version and remain immutable. */
export const SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION =
  "recording-assessment-v3-package-audio-v1";

/** New current-V1 work records use this explicit, non-V2 contract. */
export const SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION =
  "recording-assessment-v3-simplified-work-scope-v2";
export const SIMPLIFIED_V1_RECORDING_BOUNDARY =
  "service_area_equipment_item_and_work";
export const SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL = "not_applicable";
export const SERVICE_VIDEO_AUDIO_CONTRACT_VERSION = 2;

export const SIMPLIFIED_V1_PROHIBITED_CONDITIONS = [
  "minors",
  "unrelated_bystanders_or_conversations",
  "private_documents_or_screens",
  "sensitive_financial_or_account_information",
  "credentials_access_codes_keys_or_security_information",
  "confidential_information",
] as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function bool(value: unknown): boolean {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = String(value || "").trim().toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : null;
}

export function deriveSiteControl(location: RecordingLocationChoice): DerivedSiteControl {
  if (location === "residence") return "customer_controlled_residence";
  if (location === "customer-business") return "customer_controlled_business_location";
  return "vendor_controlled_business_location";
}

export function participantPlanIncludesCustomer(plan: IntentionalParticipantPlan): boolean {
  return plan === "customer" || plan === "customer_and_assigned_service_professional";
}

export function participantPlanIncludesEmployee(plan: IntentionalParticipantPlan): boolean {
  return (
    plan === "assigned_service_professional" ||
    plan === "customer_and_assigned_service_professional"
  );
}

export function recordingPermissionRequired(
  input: Pick<RecordingScopeAssessmentInput, "recordingLocation" | "intentionalParticipantPlan">,
): boolean {
  return (
    input.recordingLocation === "residence" ||
    input.recordingLocation === "customer-business" ||
    participantPlanIncludesCustomer(input.intentionalParticipantPlan)
  );
}

export function deriveV1RecordingAuthority(
  input: Pick<RecordingScopeAssessmentInput, "recordingLocation" | "intentionalParticipantPlan">,
): RecordingAuthorityHolder {
  return recordingPermissionRequired(input) ? "customer" : "vendor_manager";
}

export function parseRecordingScopeAssessmentInput(
  source: Record<string, unknown>,
): RecordingScopeAssessmentInput | null {
  const recordingLocation = normalizeRecordingLocationChoice(
    source.recordingLocation ?? source.vendor_job_recording_location,
  );
  const intentionalParticipantPlan = oneOf(
    source.intentionalParticipantPlan ?? source.recording_intentional_participant_plan,
    [
      "none",
      "customer",
      "assigned_service_professional",
      "customer_and_assigned_service_professional",
    ] as const,
  );
  if (!recordingLocation || !intentionalParticipantPlan) return null;

  const requestedAuthority = String(
    source.authorityHolderType ?? source.recording_authority_holder_type ?? "",
  ).trim().toLowerCase();
  const authorityHolderType = deriveV1RecordingAuthority({
    recordingLocation,
    intentionalParticipantPlan,
  });
  if (requestedAuthority && requestedAuthority !== authorityHolderType) return null;

  return {
    recordingLocation,
    intentionalParticipantPlan,
    audioRequested: bool(source.audioRequested ?? source.recording_audio_requested),
  };
}

export function deriveRecordingScopeAssessment(
  input: RecordingScopeAssessmentInput,
  context: RecordingScopeAssessmentContext,
): DerivedRecordingScopeAssessment {
  const locationSnapshotEvidenceHash = String(
    context.locationSnapshotEvidenceHash || "",
  ).trim().toLowerCase();
  if (!SHA256_PATTERN.test(locationSnapshotEvidenceHash)) {
    throw new Error("A valid immutable location snapshot hash is required.");
  }
  if (!Number.isInteger(context.generation) || context.generation < 1) {
    throw new Error("A positive assessment generation is required.");
  }
  const completedByUserId = String(context.completedByUserId || "").trim();
  if (
    !completedByUserId ||
    !(context.completedAt instanceof Date) ||
    !Number.isFinite(context.completedAt.getTime())
  ) {
    throw new Error("A valid assessment actor and timestamp are required.");
  }

  const siteControl = deriveSiteControl(input.recordingLocation);
  const permissionRequired = recordingPermissionRequired(input);
  const authorityHolderType = deriveV1RecordingAuthority(input);
  const subject = {
    intentionalParticipantPlan: input.intentionalParticipantPlan,
    prohibitedConditions: [...SIMPLIFIED_V1_PROHIBITED_CONDITIONS],
    recordingBoundary: SIMPLIFIED_V1_RECORDING_BOUNDARY,
    siteControl,
  };
  const scope = {
    assessment: {
      completedAt: context.completedAt.toISOString(),
      completedByUserId,
      generation: context.generation,
    },
    audio: {
      contractVersion: SERVICE_VIDEO_AUDIO_CONTRACT_VERSION,
      enabled: input.audioRequested,
    },
    authorityHolderType,
    contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
    initialAudience: "private",
    location: {
      snapshotEvidenceHash: locationSnapshotEvidenceHash,
      type: input.recordingLocation,
    },
    participantPlan: input.intentionalParticipantPlan,
    permissionRequired,
    publicSharingIncluded: false,
    recordingBoundary: SIMPLIFIED_V1_RECORDING_BOUNDARY,
    siteControl,
    subject,
  };
  const subjectJson = stableJson(subject);
  const scopeJson = stableJson(scope);
  const scopeHash = createHash("sha256").update(scopeJson).digest("hex");
  const authorities = new Map<string, "VERIFIED" | "PENDING">([
    ["VENDOR_MANAGER", "VERIFIED"],
  ]);
  if (permissionRequired) authorities.set("CUSTOMER", "PENDING");
  if (participantPlanIncludesCustomer(input.intentionalParticipantPlan)) {
    authorities.set("CUSTOMER_LIKENESS", "PENDING");
  }
  if (participantPlanIncludesEmployee(input.intentionalParticipantPlan)) {
    authorities.set("EMPLOYEE_LIKENESS", "PENDING");
  }
  const riskLevel =
    participantPlanIncludesCustomer(input.intentionalParticipantPlan) ||
    participantPlanIncludesEmployee(input.intentionalParticipantPlan)
      ? "LEVEL_3"
      : input.recordingLocation === "business"
        ? "LEVEL_1"
        : "LEVEL_2";

  return {
    ...input,
    contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
    siteControl,
    recordingBoundary: SIMPLIFIED_V1_RECORDING_BOUNDARY,
    prohibitedConditions: SIMPLIFIED_V1_PROHIBITED_CONDITIONS,
    locationSnapshotEvidenceHash,
    generation: context.generation,
    completedByUserId,
    completedAt: context.completedAt,
    authorityHolderType,
    riskLevel,
    permissionRequired,
    noticeRequired: true,
    audioAllowed: input.audioRequested,
    serviceCanContinueWithoutRecording: false,
    essentialPrivateRecording: true,
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
  const generation = input.generation ?? input.assessment.generation;
  if (generation !== input.assessment.generation) {
    throw new Error("Assessment generation does not match its canonical evidence.");
  }
  if (input.completedByUserId !== input.assessment.completedByUserId) {
    throw new Error("Assessment actor does not match its canonical evidence.");
  }
  const created = await input.tx.recordingScopeAssessment.create({
    data: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      generation,
      isCurrent: true,
      status: "COMPLETE",
      contractVersion: input.assessment.contractVersion,
      locationType: input.assessment.recordingLocation,
      riskLevel: input.assessment.riskLevel,
      propertyScope: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      peopleScope: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      frameControl: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      subjectJson: input.assessment.subjectJson,
      scopeJson: input.assessment.scopeJson,
      scopeHash: input.assessment.scopeHash,
      audioRequested: input.assessment.audioRequested,
      audioAllowed: input.assessment.audioAllowed,
      permissionRequired: input.assessment.permissionRequired,
      noticeRequired: true,
      serviceCanContinueWithoutRecording: false,
      essentialPrivateRecording: true,
      authorityHolderType: input.assessment.authorityHolderType,
      completedByUserId: input.completedByUserId,
      completedAt: input.assessment.completedAt,
    },
  });
  await input.tx.recordingAuthorityRequirement.createMany({
    data: input.assessment.authorityRequirements.map((requirement) => ({
      assessmentId: created.id,
      ...requirement,
      actorUserId:
        requirement.authorityType === "VENDOR_MANAGER" ? input.completedByUserId : null,
      verifiedAt: requirement.status === "VERIFIED" ? input.assessment.completedAt : null,
    })),
  });
  return created;
}
