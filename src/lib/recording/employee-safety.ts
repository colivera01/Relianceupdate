import { createHash } from "node:crypto";

import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  stableJsonV2,
} from "./assessment-v2";

export const EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION =
  "employee-pre-recording-safety-v1" as const;
export const EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION =
  "employee-pre-recording-safety-v2" as const;

export const EMPLOYEE_RECORDING_SAFETY_CHECK_TYPES = ["INITIAL", "STAGE_RECHECK"] as const;
export const EMPLOYEE_RECORDING_SAFETY_STAGES = [
  "STARTING_CONDITION",
  "WORK_IN_PROGRESS",
  "COMPLETED_WORK",
] as const;
export const EMPLOYEE_RECORDING_SAFETY_RESULTS = [
  "READY",
  "BLOCKED",
  "MATERIAL_SCOPE_CHANGE_REQUIRED",
] as const;
export const EMPLOYEE_RECORDING_SAFETY_ISSUES = [
  "UNEXPECTED_ADULT_PERSON",
  "MINOR_PRESENT",
  "PRIVATE_DOCUMENT_OR_SCREEN",
  "SENSITIVE_PERSONAL_INFORMATION_VISIBLE",
  "KEY_ACCESS_CODE_PASSWORD_OR_SECURITY_INFORMATION",
  "CONFIDENTIAL_BUSINESS_INFORMATION_VISIBLE",
  "UNRELATED_PRIVATE_CONVERSATION",
  "OUTSIDE_APPROVED_RECORDING_AREA",
  "APPROVED_PEOPLE_SCOPE_MISMATCH",
  "APPROVED_AUDIO_SCOPE_MISMATCH",
  "MATERIAL_SCOPE_EXPANSION_REQUIRED",
] as const;

export type EmployeeRecordingSafetyCheckType =
  (typeof EMPLOYEE_RECORDING_SAFETY_CHECK_TYPES)[number];
export type EmployeeRecordingSafetyStage =
  (typeof EMPLOYEE_RECORDING_SAFETY_STAGES)[number];
export type EmployeeRecordingSafetyResult =
  (typeof EMPLOYEE_RECORDING_SAFETY_RESULTS)[number];
export type EmployeeRecordingSafetyIssue =
  (typeof EMPLOYEE_RECORDING_SAFETY_ISSUES)[number];

export type EmployeeRecordingSafetyEvidence = {
  contractVersion:
    | typeof EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION
    | typeof EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION;
  sequence: number;
  workRecord: {
    bookingId: string;
    vendorId: string;
  };
  assessment: {
    id: string;
    generation: number;
    contractVersion: typeof RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
    scopeHash: string;
  };
  location: {
    snapshotEvidenceHash: string;
    attemptId?: string;
    attemptEvidenceHash?: string;
  };
  employee: {
    membershipId: string;
    assignmentGeneration: number;
  };
  check: {
    type: EmployeeRecordingSafetyCheckType;
    stage: EmployeeRecordingSafetyStage;
  };
  issues: EmployeeRecordingSafetyIssue[];
  result: EmployeeRecordingSafetyResult;
  submission?: {
    requestHash: string;
    bodyHash: string;
  };
  predecessor: {
    id: string;
    evidenceHash: string;
  } | null;
  createdAt: string;
};

export type CanonicalEmployeeRecordingSafetyEvidence = {
  evidence: EmployeeRecordingSafetyEvidence;
  canonicalJson: string;
  issueCodesJson: string;
  evidenceHash: string;
};

export type StoredEmployeeRecordingSafetyEvidence = {
  id: string;
  bookingId: string;
  vendorId: string;
  assessmentId: string;
  assessmentGeneration: number;
  assessmentContractVersion: string;
  assessmentScopeHash: string;
  locationSnapshotEvidenceHash: string;
  locationAttemptId?: string | null;
  locationAttemptEvidenceHash?: string | null;
  membershipId: string;
  assignmentGeneration: number;
  safetyContractVersion: string;
  checkType: string;
  stage: string;
  result: string;
  issueCodesJson: string;
  sequence: number;
  predecessorEvidenceId: string | null;
  predecessorEvidenceHash: string | null;
  submissionRequestHash?: string | null;
  submissionBodyHash?: string | null;
  evidenceHash: string;
  canonicalJson: string;
  createdAt: Date | string;
};

export type V2StageSafetyReadiness = {
  required: boolean;
  ready: boolean;
  code: string | null;
  result: EmployeeRecordingSafetyResult | null;
  evidenceId: string | null;
  evidenceHash: string | null;
  locationAttemptId: string | null;
  locationAttemptEvidenceHash: string | null;
  stage: EmployeeRecordingSafetyStage | null;
  checkType: EmployeeRecordingSafetyCheckType | null;
};

export class EmployeeRecordingSafetyValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeRecordingSafetyValidationError";
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function invalid(code: string, message: string): never {
  throw new EmployeeRecordingSafetyValidationError(code, message);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("INVALID_OBJECT", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unknown) invalid("UNKNOWN_FIELD", `${label} contains unknown field: ${unknown}.`);
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || CONTROL_CHARACTER_PATTERN.test(value)) {
    return invalid("INVALID_IDENTIFIER", `${label} must be a nonempty identifier.`);
  }
  const normalized = value.trim();
  if (normalized !== value || normalized.length > 191) {
    return invalid("INVALID_IDENTIFIER", `${label} is not canonical.`);
  }
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    return invalid("INVALID_SEQUENCE", `${label} must be a positive integer.`);
  }
  return Number(value);
}

function hashValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    return invalid("INVALID_HASH", `${label} must be a lowercase SHA-256 value.`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return invalid("UNKNOWN_ENUM_VALUE", `${label} contains an unsupported value.`);
  }
  return value as T;
}

function canonicalTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) {
    return invalid("INVALID_TIMESTAMP", "createdAt must be an ISO-8601 timestamp.");
  }
  const canonical = new Date(value).toISOString();
  if (canonical !== value) {
    return invalid("INVALID_TIMESTAMP", "createdAt must use canonical UTC ISO-8601 form.");
  }
  return canonical;
}

function parseIssues(value: unknown): EmployeeRecordingSafetyIssue[] {
  if (!Array.isArray(value)) return invalid("INVALID_ISSUES", "issues must be an array.");
  const seen = new Set<EmployeeRecordingSafetyIssue>();
  for (const item of value) {
    const issue = enumValue(item, EMPLOYEE_RECORDING_SAFETY_ISSUES, "issues");
    if (seen.has(issue)) invalid("DUPLICATE_ISSUE", "issues contains a duplicate value.");
    seen.add(issue);
  }
  return EMPLOYEE_RECORDING_SAFETY_ISSUES.filter((issue) => seen.has(issue));
}

function validateStageCheckPair(
  checkType: EmployeeRecordingSafetyCheckType,
  stage: EmployeeRecordingSafetyStage,
) {
  if (stage === "STARTING_CONDITION" && checkType !== "INITIAL") {
    invalid("CHECK_STAGE_MISMATCH", "Starting Condition requires an INITIAL safety check.");
  }
  if (stage !== "STARTING_CONDITION" && checkType !== "STAGE_RECHECK") {
    invalid("CHECK_STAGE_MISMATCH", "Later Service Video stages require a STAGE_RECHECK.");
  }
}

function validateResultIssues(
  result: EmployeeRecordingSafetyResult,
  issues: EmployeeRecordingSafetyIssue[],
) {
  const material = issues.includes("MATERIAL_SCOPE_EXPANSION_REQUIRED");
  if (result === "READY" && issues.length > 0) {
    invalid("READY_WITH_ISSUES", "READY safety evidence cannot contain an unresolved issue.");
  }
  if (result === "BLOCKED" && issues.length === 0) {
    invalid("BLOCKED_WITHOUT_ISSUES", "BLOCKED safety evidence requires an issue.");
  }
  if (result === "BLOCKED" && material) {
    invalid(
      "MATERIAL_RESULT_REQUIRED",
      "A material scope expansion must use MATERIAL_SCOPE_CHANGE_REQUIRED.",
    );
  }
  if (result === "MATERIAL_SCOPE_CHANGE_REQUIRED" && !material) {
    invalid(
      "MATERIAL_ISSUE_REQUIRED",
      "MATERIAL_SCOPE_CHANGE_REQUIRED requires the material-scope issue code.",
    );
  }
}

export function parseEmployeeRecordingSafetyEvidence(
  source: unknown,
): CanonicalEmployeeRecordingSafetyEvidence {
  const input = objectValue(source, "employee safety evidence");
  rejectUnknownKeys(
    input,
    [
      "contractVersion",
      "sequence",
      "workRecord",
      "assessment",
      "location",
      "employee",
      "check",
      "issues",
      "result",
      "submission",
      "predecessor",
      "createdAt",
    ],
    "employee safety evidence",
  );
  const hardened = input.contractVersion === EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION;
  if (!hardened && input.contractVersion !== EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION) {
    invalid("CONTRACT_VERSION_MISMATCH", "The employee runtime-safety contract is required.");
  }

  const workRecord = objectValue(input.workRecord, "workRecord");
  rejectUnknownKeys(workRecord, ["bookingId", "vendorId"], "workRecord");

  const assessment = objectValue(input.assessment, "assessment");
  rejectUnknownKeys(
    assessment,
    ["id", "generation", "contractVersion", "scopeHash"],
    "assessment",
  );
  if (assessment.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    invalid("ASSESSMENT_VERSION_MISMATCH", "Safety evidence requires the V2 assessment contract.");
  }

  const location = objectValue(input.location, "location");
  rejectUnknownKeys(
    location,
    hardened
      ? ["snapshotEvidenceHash", "attemptId", "attemptEvidenceHash"]
      : ["snapshotEvidenceHash"],
    "location",
  );
  const employee = objectValue(input.employee, "employee");
  rejectUnknownKeys(employee, ["membershipId", "assignmentGeneration"], "employee");
  const check = objectValue(input.check, "check");
  rejectUnknownKeys(check, ["type", "stage"], "check");

  const checkType = enumValue(
    check.type,
    EMPLOYEE_RECORDING_SAFETY_CHECK_TYPES,
    "check.type",
  );
  const stage = enumValue(check.stage, EMPLOYEE_RECORDING_SAFETY_STAGES, "check.stage");
  validateStageCheckPair(checkType, stage);
  const issues = parseIssues(input.issues);
  const result = enumValue(input.result, EMPLOYEE_RECORDING_SAFETY_RESULTS, "result");
  validateResultIssues(result, issues);

  let submission: EmployeeRecordingSafetyEvidence["submission"];
  if (hardened) {
    const value = objectValue(input.submission, "submission");
    rejectUnknownKeys(value, ["requestHash", "bodyHash"], "submission");
    submission = {
      requestHash: hashValue(value.requestHash, "submission.requestHash"),
      bodyHash: hashValue(value.bodyHash, "submission.bodyHash"),
    };
  } else if (input.submission !== undefined) {
    invalid("UNKNOWN_FIELD", "Legacy safety evidence cannot contain submission identity.");
  }

  let predecessor: EmployeeRecordingSafetyEvidence["predecessor"] = null;
  if (input.predecessor !== null) {
    const value = objectValue(input.predecessor, "predecessor");
    rejectUnknownKeys(value, ["id", "evidenceHash"], "predecessor");
    predecessor = {
      id: identifier(value.id, "predecessor.id"),
      evidenceHash: hashValue(value.evidenceHash, "predecessor.evidenceHash"),
    };
  }

  const sequence = positiveInteger(input.sequence, "sequence");
  if ((sequence === 1) !== (predecessor === null)) {
    invalid(
      "PREDECESSOR_SEQUENCE_MISMATCH",
      "Only the first safety check may omit a predecessor.",
    );
  }

  const evidence: EmployeeRecordingSafetyEvidence = {
    contractVersion: hardened
      ? EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION
      : EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION,
    sequence,
    workRecord: {
      bookingId: identifier(workRecord.bookingId, "workRecord.bookingId"),
      vendorId: identifier(workRecord.vendorId, "workRecord.vendorId"),
    },
    assessment: {
      id: identifier(assessment.id, "assessment.id"),
      generation: positiveInteger(assessment.generation, "assessment.generation"),
      contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      scopeHash: hashValue(assessment.scopeHash, "assessment.scopeHash"),
    },
    location: {
      snapshotEvidenceHash: hashValue(
        location.snapshotEvidenceHash,
        "location.snapshotEvidenceHash",
      ),
      ...(hardened
        ? {
            attemptId: identifier(location.attemptId, "location.attemptId"),
            attemptEvidenceHash: hashValue(
              location.attemptEvidenceHash,
              "location.attemptEvidenceHash",
            ),
          }
        : {}),
    },
    employee: {
      membershipId: identifier(employee.membershipId, "employee.membershipId"),
      assignmentGeneration: positiveInteger(
        employee.assignmentGeneration,
        "employee.assignmentGeneration",
      ),
    },
    check: { type: checkType, stage },
    issues,
    result,
    ...(hardened ? { submission } : {}),
    predecessor,
    createdAt: canonicalTimestamp(input.createdAt),
  };
  const canonicalJson = stableJsonV2(evidence);
  return {
    evidence,
    canonicalJson,
    issueCodesJson: stableJsonV2(issues),
    evidenceHash: createHash("sha256").update(canonicalJson, "utf8").digest("hex"),
  };
}

export function requiredSafetyCheckForStage(stage: string | null | undefined): {
  stage: EmployeeRecordingSafetyStage;
  checkType: EmployeeRecordingSafetyCheckType;
} | null {
  const normalized = String(stage || "").trim().toUpperCase();
  if (normalized === "INTRO" || normalized === "STARTING_CONDITION") {
    return { stage: "STARTING_CONDITION", checkType: "INITIAL" };
  }
  if (normalized === "IN_PROGRESS" || normalized === "WORK_IN_PROGRESS") {
    return { stage: "WORK_IN_PROGRESS", checkType: "STAGE_RECHECK" };
  }
  if (normalized === "COMPLETED" || normalized === "COMPLETED_WORK") {
    return { stage: "COMPLETED_WORK", checkType: "STAGE_RECHECK" };
  }
  return null;
}

export function employeeSafetyChainKey(input: {
  bookingId: string;
  vendorId: string;
  assessmentId: string;
  assessmentGeneration: number;
  assessmentContractVersion: string;
  assessmentScopeHash: string;
  locationSnapshotEvidenceHash: string;
  membershipId: string;
  assignmentGeneration: number;
  checkType: EmployeeRecordingSafetyCheckType;
  stage: EmployeeRecordingSafetyStage;
}): string {
  return createHash("sha256")
    .update(stableJsonV2(input), "utf8")
    .digest("hex");
}

export function storedSafetyEvidenceToCanonicalInput(
  row: StoredEmployeeRecordingSafetyEvidence,
): EmployeeRecordingSafetyEvidence {
  let issues: unknown;
  try {
    issues = JSON.parse(row.issueCodesJson);
  } catch {
    return invalid("INVALID_STORED_ISSUES", "Stored safety issue evidence is invalid JSON.");
  }
  return {
    contractVersion: row.safetyContractVersion as EmployeeRecordingSafetyEvidence["contractVersion"],
    sequence: row.sequence,
    workRecord: { bookingId: row.bookingId, vendorId: row.vendorId },
    assessment: {
      id: row.assessmentId,
      generation: row.assessmentGeneration,
      contractVersion:
        row.assessmentContractVersion as typeof RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      scopeHash: row.assessmentScopeHash,
    },
    location: {
      snapshotEvidenceHash: row.locationSnapshotEvidenceHash,
      ...(row.safetyContractVersion === EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION
        ? {
            attemptId: String(row.locationAttemptId || ""),
            attemptEvidenceHash: String(row.locationAttemptEvidenceHash || ""),
          }
        : {}),
    },
    employee: {
      membershipId: row.membershipId,
      assignmentGeneration: row.assignmentGeneration,
    },
    check: {
      type: row.checkType as EmployeeRecordingSafetyCheckType,
      stage: row.stage as EmployeeRecordingSafetyStage,
    },
    issues: issues as EmployeeRecordingSafetyIssue[],
    result: row.result as EmployeeRecordingSafetyResult,
    ...(row.safetyContractVersion === EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION
      ? {
          submission: {
            requestHash: String(row.submissionRequestHash || ""),
            bodyHash: String(row.submissionBodyHash || ""),
          },
        }
      : {}),
    predecessor:
      row.predecessorEvidenceId && row.predecessorEvidenceHash
        ? { id: row.predecessorEvidenceId, evidenceHash: row.predecessorEvidenceHash }
        : null,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function notRequired(): V2StageSafetyReadiness {
  return {
    required: false,
    ready: true,
    code: null,
    result: null,
    evidenceId: null,
    evidenceHash: null,
    locationAttemptId: null,
    locationAttemptEvidenceHash: null,
    stage: null,
    checkType: null,
  };
}

function blockedReadiness(
  code: string,
  requirement: ReturnType<typeof requiredSafetyCheckForStage>,
  row?: StoredEmployeeRecordingSafetyEvidence | null,
  result?: EmployeeRecordingSafetyResult | null,
): V2StageSafetyReadiness {
  return {
    required: true,
    ready: false,
    code,
    result: result ?? null,
    evidenceId: row?.id || null,
    evidenceHash: row?.evidenceHash || null,
    locationAttemptId: row?.locationAttemptId || null,
    locationAttemptEvidenceHash: row?.locationAttemptEvidenceHash || null,
    stage: requirement?.stage || null,
    checkType: requirement?.checkType || null,
  };
}

export function resolveV2StageSafetyReadiness(input: {
  bookingId: string;
  vendorId: string;
  assessment: {
    id: string;
    generation: number;
    contractVersion: string | null;
    scopeHash: string;
    scopeJson: string;
    status?: string | null;
  } | null;
  membershipId: string | null | undefined;
  assignmentGeneration: number;
  locationSnapshotEvidenceHash: string | null | undefined;
  recordingStage: string | null | undefined;
  evidence: StoredEmployeeRecordingSafetyEvidence[];
}): V2StageSafetyReadiness {
  if (input.assessment?.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    return notRequired();
  }
  const requirement = requiredSafetyCheckForStage(input.recordingStage);
  if (!requirement) return blockedReadiness("V2_RUNTIME_SAFETY_STAGE_REQUIRED", requirement);
  if (input.assessment.status && input.assessment.status !== "COMPLETE") {
    return blockedReadiness("V2_RUNTIME_SAFETY_ASSESSMENT_INVALID", requirement);
  }

  let parsedAssessment;
  try {
    parsedAssessment = parseRecordingAssessmentV2(JSON.parse(input.assessment.scopeJson));
  } catch {
    return blockedReadiness("V2_RUNTIME_SAFETY_ASSESSMENT_INVALID", requirement);
  }
  if (
    parsedAssessment.scopeJson !== input.assessment.scopeJson ||
    parsedAssessment.scopeHash !== input.assessment.scopeHash ||
    parsedAssessment.assessment.derived.participantPolicyStatus !== "SUPPORTED"
  ) {
    return blockedReadiness(
      parsedAssessment.assessment.derived.participantPolicyStatus === "SUPPORTED"
        ? "V2_RUNTIME_SAFETY_ASSESSMENT_INVALID"
        : "V2_RUNTIME_SAFETY_PLAN_CHANGE_REQUIRED",
      requirement,
    );
  }
  if (
    !input.membershipId ||
    !input.locationSnapshotEvidenceHash ||
    parsedAssessment.assessment.location.snapshotEvidenceHash !==
      input.locationSnapshotEvidenceHash
  ) {
    return blockedReadiness("V2_RUNTIME_SAFETY_BINDING_STALE", requirement);
  }

  const relevantStageRows = input.evidence.filter(
    (row) => row.stage === requirement.stage && row.checkType === requirement.checkType,
  );
  const matching = relevantStageRows.filter(
    (row) =>
      row.bookingId === input.bookingId &&
      row.vendorId === input.vendorId &&
      row.assessmentId === input.assessment?.id &&
      row.assessmentGeneration === input.assessment?.generation &&
      row.assessmentContractVersion === input.assessment?.contractVersion &&
      row.assessmentScopeHash === input.assessment?.scopeHash &&
      row.locationSnapshotEvidenceHash === input.locationSnapshotEvidenceHash &&
      row.membershipId === input.membershipId &&
      row.assignmentGeneration === input.assignmentGeneration &&
      row.safetyContractVersion === EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION &&
      Boolean(row.locationAttemptId) &&
      Boolean(row.locationAttemptEvidenceHash) &&
      Boolean(row.submissionRequestHash) &&
      Boolean(row.submissionBodyHash),
  );
  if (matching.length === 0) {
    return blockedReadiness(
      relevantStageRows.length > 0
        ? "V2_RUNTIME_SAFETY_BINDING_STALE"
        : "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
      requirement,
    );
  }
  const ordered = [...matching].sort((left, right) => {
    if (left.sequence !== right.sequence) return right.sequence - left.sequence;
    const timeDifference = Date.parse(String(right.createdAt)) - Date.parse(String(left.createdAt));
    if (timeDifference !== 0) return timeDifference;
    return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
  });
  if (ordered.length > 1 && ordered[0].sequence === ordered[1].sequence) {
    return blockedReadiness("V2_RUNTIME_SAFETY_EVIDENCE_AMBIGUOUS", requirement);
  }
  const parsedRows: Array<{
    row: StoredEmployeeRecordingSafetyEvidence;
    canonical: CanonicalEmployeeRecordingSafetyEvidence;
  }> = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    let canonical: CanonicalEmployeeRecordingSafetyEvidence;
    try {
      canonical = parseEmployeeRecordingSafetyEvidence(storedSafetyEvidenceToCanonicalInput(row));
    } catch {
      return blockedReadiness("V2_RUNTIME_SAFETY_EVIDENCE_INVALID", requirement, row);
    }
    if (
      canonical.evidenceHash !== row.evidenceHash ||
      canonical.canonicalJson !== row.canonicalJson
    ) {
      return blockedReadiness("V2_RUNTIME_SAFETY_EVIDENCE_INVALID", requirement, row);
    }
    const predecessor = ordered[index + 1];
    if (
      (predecessor &&
        (row.sequence !== predecessor.sequence + 1 ||
          row.predecessorEvidenceId !== predecessor.id ||
          row.predecessorEvidenceHash !== predecessor.evidenceHash)) ||
      (!predecessor && row.sequence !== 1)
    ) {
      return blockedReadiness("V2_RUNTIME_SAFETY_EVIDENCE_INVALID", requirement, row);
    }
    parsedRows.push({ row, canonical });
  }
  const material = parsedRows.find(
    ({ canonical }) => canonical.evidence.result === "MATERIAL_SCOPE_CHANGE_REQUIRED",
  );
  if (material) {
    return blockedReadiness(
      "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED",
      requirement,
      material.row,
      "MATERIAL_SCOPE_CHANGE_REQUIRED",
    );
  }
  const latest = parsedRows[0].row;
  const canonical = parsedRows[0].canonical;
  if (canonical.evidence.result === "READY") {
    return {
      required: true,
      ready: true,
      code: null,
      result: "READY",
      evidenceId: latest.id,
      evidenceHash: latest.evidenceHash,
      locationAttemptId: latest.locationAttemptId || null,
      locationAttemptEvidenceHash: latest.locationAttemptEvidenceHash || null,
      stage: requirement.stage,
      checkType: requirement.checkType,
    };
  }
  return blockedReadiness(
    canonical.evidence.result === "MATERIAL_SCOPE_CHANGE_REQUIRED"
      ? "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED"
      : "V2_RUNTIME_SAFETY_BLOCKED",
    requirement,
    latest,
    canonical.evidence.result,
  );
}
