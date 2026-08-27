import { SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION } from "./scope-assessment";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  RecordingAssessmentV2ValidationError,
  type CanonicalRecordingAssessmentV2,
} from "./assessment-v2";

export type RecordingAssessmentEvidenceRow = {
  contractVersion?: string | null;
  scopeJson: string;
  subjectJson: string;
  scopeHash: string;
  propertyScope?: string | null;
  peopleScope?: string | null;
  frameControl?: string | null;
  audioRequested?: boolean | null;
  audioAllowed?: boolean | null;
};

export type RecordingAssessmentInterpretation =
  | {
      kind: "V2";
      contractVersion: typeof RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
      canonical: CanonicalRecordingAssessmentV2;
    }
  | {
      kind: "CURRENT_V3" | "LEGACY";
      contractVersion: null;
      scopeSchemaVersion: string | null;
      scopeJson: string;
      subjectJson: string;
      scopeHash: string;
      scopeEvidence: Record<string, unknown>;
      subjectEvidence: Record<string, unknown>;
      scalarEvidence: {
        propertyScope: string | null;
        peopleScope: string | null;
        peopleSummary: string;
        frameControl: string | null;
        audioRequested: boolean;
        audioAllowed: boolean;
      };
    };

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function historicalPeopleSummary(value: string | null): string {
  switch (value) {
    case "none":
      return "No identifiable people — historical assessment";
    case "customer":
      return "Customer — historical assessment";
    case "employee":
      return "Employee — historical assessment";
    case "multiple":
      return "Multiple people — historical assessment";
    default:
      return "People scope unavailable — historical assessment";
  }
}

export function interpretRecordingAssessment(
  row: RecordingAssessmentEvidenceRow,
): RecordingAssessmentInterpretation {
  const explicitVersion = String(row.contractVersion || "").trim() || null;
  const parsedScope = parseJsonObject(row.scopeJson);
  const parsedSubject = parseJsonObject(row.subjectJson);

  if (explicitVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    const canonical = parseRecordingAssessmentV2(parsedScope);
    if (canonical.scopeJson !== row.scopeJson) {
      throw new RecordingAssessmentV2ValidationError(
        "NON_CANONICAL_SCOPE_JSON",
        "Stored V2 scopeJson is not the canonical serialization.",
      );
    }
    if (canonical.subjectJson !== row.subjectJson) {
      throw new RecordingAssessmentV2ValidationError(
        "SUBJECT_JSON_MISMATCH",
        "Stored V2 subjectJson does not match the canonical assessment.",
      );
    }
    if (canonical.scopeHash !== row.scopeHash) {
      throw new RecordingAssessmentV2ValidationError(
        "SCOPE_HASH_MISMATCH",
        "Stored V2 scopeHash does not match canonical evidence.",
      );
    }
    return {
      kind: "V2",
      contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      canonical,
    };
  }

  if (explicitVersion) {
    throw new RecordingAssessmentV2ValidationError(
      "UNKNOWN_CONTRACT_VERSION",
      "The recording-assessment contract version is unsupported.",
    );
  }
  if (parsedScope.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    throw new RecordingAssessmentV2ValidationError(
      "MISSING_EXPLICIT_CONTRACT_VERSION",
      "V2 evidence requires an explicit database contractVersion.",
    );
  }

  const scopeSchemaVersion =
    typeof parsedScope.schemaVersion === "string" ? parsedScope.schemaVersion : null;
  const peopleScope = String(row.peopleScope || "").trim().toLowerCase() || null;
  return {
    kind:
      scopeSchemaVersion === SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION
        ? "CURRENT_V3"
        : "LEGACY",
    contractVersion: null,
    scopeSchemaVersion,
    scopeJson: row.scopeJson,
    subjectJson: row.subjectJson,
    scopeHash: row.scopeHash,
    scopeEvidence: parsedScope,
    subjectEvidence: parsedSubject,
    scalarEvidence: {
      propertyScope: String(row.propertyScope || "").trim().toLowerCase() || null,
      peopleScope,
      peopleSummary: historicalPeopleSummary(peopleScope),
      frameControl: String(row.frameControl || "").trim().toLowerCase() || null,
      audioRequested: row.audioRequested === true,
      audioAllowed: row.audioAllowed === true,
    },
  };
}
