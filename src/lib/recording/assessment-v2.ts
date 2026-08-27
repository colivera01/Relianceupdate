import { createHash } from "node:crypto";

export const RECORDING_ASSESSMENT_V2_CONTRACT_VERSION =
  "recording-assessment-v4-multiscope-safety-v1" as const;

export const V2_INTENDED_SUBJECTS = [
  "SERVICE_AREA_OR_EQUIPMENT",
  "EXISTING_CONDITION_OR_DAMAGE",
  "WORK_BEING_PERFORMED",
  "COMPLETED_WORK_OR_FINAL_CONDITION",
  "NECESSARY_SURROUNDING_AREA",
  "SERVICE_PARTICIPANTS",
  "OTHER",
] as const;

export const V2_EXPECTED_PEOPLE = [
  "NO_IDENTIFIABLE_PEOPLE",
  "ASSIGNED_SERVICE_PROFESSIONAL",
  "CUSTOMER",
  "OTHER_ADULT_SERVICE_PARTICIPANT",
  "BYSTANDER_NONPARTICIPANT",
  "MINOR",
] as const;

export const V2_RECORDING_LOCATION_TYPES = [
  "VENDOR_BUSINESS",
  "CUSTOMER_RESIDENCE",
  "CUSTOMER_BUSINESS",
] as const;

export const V2_RECORDING_FORMATS = ["VIDEO_ONLY", "VIDEO_AUDIO"] as const;
export const V2_RECORDING_AREA_BOUNDARIES = [
  "SERVICE_AREA_ONLY",
  "NECESSARY_SURROUNDINGS",
] as const;

const V2_UNSUPPORTED_INTENTIONAL_PEOPLE = new Set<ExpectedPerson>([
  "OTHER_ADULT_SERVICE_PARTICIPANT",
  "BYSTANDER_NONPARTICIPANT",
  "MINOR",
]);

const OTHER_SUBJECT_DESCRIPTION_MAX_LENGTH = 160;
const RECORDING_AREA_EXPLANATION_MAX_LENGTH = 240;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type IntendedSubject = (typeof V2_INTENDED_SUBJECTS)[number];
export type ExpectedPerson = (typeof V2_EXPECTED_PEOPLE)[number];
export type RecordingLocationTypeV2 = (typeof V2_RECORDING_LOCATION_TYPES)[number];
export type RecordingFormatV2 = (typeof V2_RECORDING_FORMATS)[number];
export type RecordingAreaBoundaryV2 = (typeof V2_RECORDING_AREA_BOUNDARIES)[number];
export type V2ParticipantPolicyStatus = "SUPPORTED" | "PLAN_CHANGE_REQUIRED";
export type V2ExpectedAuthority = "CUSTOMER" | "VENDOR_MANAGER";

export type RecordingAssessmentV2 = {
  contractVersion: typeof RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
  location: {
    type: RecordingLocationTypeV2;
    snapshotEvidenceHash: string;
  };
  intendedSubjects: IntendedSubject[];
  otherSubjectDescription?: string;
  expectedPeople: ExpectedPerson[];
  recordingFormat: RecordingFormatV2;
  recordingArea: {
    boundary: RecordingAreaBoundaryV2;
    explanation?: string;
  };
  visibility: {
    initialAudience: "PRIVATE";
    publicAuthorizationIncluded: false;
  };
  derived: {
    customerPermissionRequired: boolean;
    expectedAuthority: V2ExpectedAuthority;
    participantPolicyStatus: V2ParticipantPolicyStatus;
  };
};

export type CanonicalRecordingAssessmentV2 = {
  assessment: RecordingAssessmentV2;
  subjectJson: string;
  scopeJson: string;
  scopeHash: string;
};

export class RecordingAssessmentV2ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecordingAssessmentV2ValidationError";
  }
}

function invalid(code: string, message: string): never {
  throw new RecordingAssessmentV2ValidationError(code, message);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("INVALID_OBJECT", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    invalid("UNKNOWN_FIELD", `${label} contains unknown field: ${unknown[0]}.`);
  }
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return invalid("UNKNOWN_ENUM_VALUE", `${label} contains an unsupported value.`);
  }
  return value as T;
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("EMPTY_SELECTION", `${label} must contain at least one value.`);
  }
  const seen = new Set<T>();
  for (const item of value) {
    const parsed = enumValue(item, allowed, label);
    if (seen.has(parsed)) {
      invalid("DUPLICATE_SELECTION", `${label} contains a duplicate value.`);
    }
    seen.add(parsed);
  }
  return allowed.filter((item) => seen.has(item));
}

function normalizedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    return invalid("MISSING_TEXT", `${label} is required.`);
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return invalid("CONTROL_CHARACTER", `${label} contains a control character.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return invalid("MISSING_TEXT", `${label} is required.`);
  if (normalized.length > maxLength) {
    return invalid("TEXT_TOO_LONG", `${label} is too long.`);
  }
  return normalized;
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function stableJsonV2(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonV2).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.some(([, item]) => item === undefined)) {
      return invalid("UNDEFINED_CANONICAL_VALUE", "Canonical V2 evidence cannot contain undefined.");
    }
    return `{${entries
      .sort(([left], [right]) => lexicalCompare(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonV2(item)}`)
      .join(",")}}`;
  }
  return invalid("UNSUPPORTED_CANONICAL_VALUE", "Canonical V2 evidence contains an unsupported value.");
}

function parseLocation(value: unknown): RecordingAssessmentV2["location"] {
  const location = objectValue(value, "location");
  rejectUnknownKeys(location, ["type", "snapshotEvidenceHash"], "location");
  const snapshotEvidenceHash = location.snapshotEvidenceHash;
  if (typeof snapshotEvidenceHash !== "string" || !SHA256_PATTERN.test(snapshotEvidenceHash)) {
    invalid("INVALID_LOCATION_HASH", "location.snapshotEvidenceHash must be a lowercase SHA-256 value.");
  }
  return {
    type: enumValue(location.type, V2_RECORDING_LOCATION_TYPES, "location.type"),
    snapshotEvidenceHash,
  };
}

function parseRecordingArea(value: unknown): RecordingAssessmentV2["recordingArea"] {
  const area = objectValue(value, "recordingArea");
  rejectUnknownKeys(area, ["boundary", "explanation"], "recordingArea");
  const boundary = enumValue(
    area.boundary,
    V2_RECORDING_AREA_BOUNDARIES,
    "recordingArea.boundary",
  );
  if (boundary === "SERVICE_AREA_ONLY") {
    if (area.explanation !== undefined && String(area.explanation).trim()) {
      invalid(
        "UNEXPECTED_AREA_EXPLANATION",
        "recordingArea.explanation is only valid for necessary surroundings.",
      );
    }
    return { boundary };
  }
  return {
    boundary,
    explanation: normalizedText(
      area.explanation,
      "recordingArea.explanation",
      RECORDING_AREA_EXPLANATION_MAX_LENGTH,
    ),
  };
}

function deriveV2Policy(input: {
  locationType: RecordingLocationTypeV2;
  expectedPeople: ExpectedPerson[];
  recordingFormat: RecordingFormatV2;
}) {
  const customerPermissionRequired =
    input.locationType === "CUSTOMER_RESIDENCE" ||
    input.locationType === "CUSTOMER_BUSINESS" ||
    input.expectedPeople.includes("CUSTOMER") ||
    input.recordingFormat === "VIDEO_AUDIO";
  const participantPolicyStatus: V2ParticipantPolicyStatus = input.expectedPeople.some(
    (person) => V2_UNSUPPORTED_INTENTIONAL_PEOPLE.has(person),
  )
    ? "PLAN_CHANGE_REQUIRED"
    : "SUPPORTED";
  return {
    customerPermissionRequired,
    expectedAuthority: customerPermissionRequired ? "CUSTOMER" : "VENDOR_MANAGER",
    participantPolicyStatus,
  } as const;
}

function validateVisibility(value: unknown) {
  if (value === undefined) return;
  const visibility = objectValue(value, "visibility");
  rejectUnknownKeys(
    visibility,
    ["initialAudience", "publicAuthorizationIncluded"],
    "visibility",
  );
  if (
    visibility.initialAudience !== "PRIVATE" ||
    visibility.publicAuthorizationIncluded !== false
  ) {
    invalid(
      "PUBLIC_AUTHORIZATION_NOT_ALLOWED",
      "V2 recording permission is Private by default and cannot include Public authorization.",
    );
  }
}

function validateDerived(value: unknown, expected: RecordingAssessmentV2["derived"]) {
  if (value === undefined) return;
  const derived = objectValue(value, "derived");
  rejectUnknownKeys(
    derived,
    ["customerPermissionRequired", "expectedAuthority", "participantPolicyStatus"],
    "derived",
  );
  if (
    derived.customerPermissionRequired !== expected.customerPermissionRequired ||
    derived.expectedAuthority !== expected.expectedAuthority ||
    derived.participantPolicyStatus !== expected.participantPolicyStatus
  ) {
    invalid("DERIVED_VALUE_MISMATCH", "V2 derived values do not match the canonical policy.");
  }
}

export function parseRecordingAssessmentV2(source: unknown): CanonicalRecordingAssessmentV2 {
  const input = objectValue(source, "recording assessment");
  rejectUnknownKeys(
    input,
    [
      "contractVersion",
      "location",
      "intendedSubjects",
      "otherSubjectDescription",
      "expectedPeople",
      "recordingFormat",
      "recordingArea",
      "visibility",
      "derived",
    ],
    "recording assessment",
  );
  if (input.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    invalid("CONTRACT_VERSION_MISMATCH", "The V2 recording-assessment version is required.");
  }

  const location = parseLocation(input.location);
  const intendedSubjects = enumArray(
    input.intendedSubjects,
    V2_INTENDED_SUBJECTS,
    "intendedSubjects",
  );
  const expectedPeople = enumArray(input.expectedPeople, V2_EXPECTED_PEOPLE, "expectedPeople");
  const recordingFormat = enumValue(
    input.recordingFormat,
    V2_RECORDING_FORMATS,
    "recordingFormat",
  );
  const recordingArea = parseRecordingArea(input.recordingArea);

  if (expectedPeople.includes("NO_IDENTIFIABLE_PEOPLE") && expectedPeople.length !== 1) {
    invalid(
      "CONTRADICTORY_PEOPLE_SCOPE",
      "NO_IDENTIFIABLE_PEOPLE cannot be combined with another expected person.",
    );
  }
  if (
    intendedSubjects.includes("SERVICE_PARTICIPANTS") &&
    expectedPeople.includes("NO_IDENTIFIABLE_PEOPLE")
  ) {
    invalid(
      "CONTRADICTORY_PARTICIPANT_SCOPE",
      "Service participants cannot be an intended subject when no identifiable people are expected.",
    );
  }
  const surroundingSubject = intendedSubjects.includes("NECESSARY_SURROUNDING_AREA");
  if (surroundingSubject !== (recordingArea.boundary === "NECESSARY_SURROUNDINGS")) {
    invalid(
      "CONTRADICTORY_RECORDING_AREA",
      "Necessary-surroundings subject and recording-area boundary must agree.",
    );
  }

  let otherSubjectDescription: string | undefined;
  if (intendedSubjects.includes("OTHER")) {
    otherSubjectDescription = normalizedText(
      input.otherSubjectDescription,
      "otherSubjectDescription",
      OTHER_SUBJECT_DESCRIPTION_MAX_LENGTH,
    );
  } else if (input.otherSubjectDescription !== undefined) {
    invalid(
      "UNEXPECTED_OTHER_DESCRIPTION",
      "otherSubjectDescription requires the OTHER intended subject.",
    );
  }

  const derived = deriveV2Policy({
    locationType: location.type,
    expectedPeople,
    recordingFormat,
  });
  validateVisibility(input.visibility);
  validateDerived(input.derived, derived);

  const assessment: RecordingAssessmentV2 = {
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location,
    intendedSubjects,
    ...(otherSubjectDescription ? { otherSubjectDescription } : {}),
    expectedPeople,
    recordingFormat,
    recordingArea,
    visibility: {
      initialAudience: "PRIVATE",
      publicAuthorizationIncluded: false,
    },
    derived,
  };
  const subjectJson = stableJsonV2({
    intendedSubjects: assessment.intendedSubjects,
    ...(assessment.otherSubjectDescription
      ? { otherSubjectDescription: assessment.otherSubjectDescription }
      : {}),
    expectedPeople: assessment.expectedPeople,
    recordingArea: assessment.recordingArea,
  });
  const scopeJson = stableJsonV2(assessment);
  const scopeHash = createHash("sha256").update(scopeJson, "utf8").digest("hex");
  return { assessment, subjectJson, scopeJson, scopeHash };
}
