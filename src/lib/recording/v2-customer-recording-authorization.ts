import { storedAuthorityEvidenceIsCurrent } from "@/lib/consent/authority-validation";
import { permissionContentForAudio } from "@/lib/consent/content-version";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
} from "./assessment-v2";

export type V2CustomerRecordingAuthorizationStatus =
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "ALLOWED"
  | "DECLINED"
  | "WRONG_RECIPIENT"
  | "STALE";

export type V2CustomerRecordingAuthorization = {
  required: boolean;
  allowed: boolean;
  status: V2CustomerRecordingAuthorizationStatus;
  consentRecordId: string | null;
  decisionEvidenceId: string | null;
  code: string | null;
};

function parseScope(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function resolveV2CustomerRecordingAuthorization(input: {
  assessment: any;
  consentRecord: any | null | undefined;
}): V2CustomerRecordingAuthorization {
  const assessment = input.assessment;
  if (
    !assessment ||
    assessment.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION ||
    assessment.status !== "COMPLETE" ||
    assessment.isCurrent === false
  ) {
    return {
      required: true,
      allowed: false,
      status: "STALE",
      consentRecordId: null,
      decisionEvidenceId: null,
      code: "ASSESSMENT_STALE",
    };
  }
  if (!assessment.permissionRequired) {
    return {
      required: false,
      allowed: true,
      status: "NOT_REQUIRED",
      consentRecordId: null,
      decisionEvidenceId: null,
      code: null,
    };
  }
  const record = input.consentRecord;
  if (!record) {
    return {
      required: true,
      allowed: false,
      status: "REQUIRED",
      consentRecordId: null,
      decisionEvidenceId: null,
      code: "CUSTOMER_RECORDING_AUTH_REQUIRED",
    };
  }
  const scope = parseScope(record.scopeJson);
  const canonicalScopeMatches = (() => {
    try {
      const {
        customerLabel: _customerLabel,
        recordingAssessmentId: _assessmentId,
        recordingAssessmentGeneration: _assessmentGeneration,
        ...assessmentScope
      } = scope;
      const canonical = parseRecordingAssessmentV2(assessmentScope);
      return canonical.scopeHash === assessment.scopeHash;
    } catch {
      return false;
    }
  })();
  const exactScope = Boolean(
    record.isCurrent === true &&
      !record.supersededAt &&
      record.scopeHash === assessment.scopeHash &&
      scope.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION &&
      scope.recordingAssessmentId === assessment.id &&
      Number(scope.recordingAssessmentGeneration) === Number(assessment.generation) &&
      canonicalScopeMatches,
  );
  if (!exactScope) {
    return {
      required: true,
      allowed: false,
      status: "STALE",
      consentRecordId: record.id || null,
      decisionEvidenceId: record.decisionEvidence?.id || null,
      code: "SCOPE_STALE",
    };
  }
  const lifecycle = String(record.lifecycleStatus || "").toUpperCase();
  if (record.recipientMismatch || lifecycle === "WRONG_RECIPIENT") {
    return {
      required: true,
      allowed: false,
      status: "WRONG_RECIPIENT",
      consentRecordId: record.id || null,
      decisionEvidenceId: null,
      code: "CUSTOMER_RECORDING_RECIPIENT_CORRECTION_REQUIRED",
    };
  }
  const decision = record.decisionEvidence;
  if (lifecycle === "DECLINED" || decision?.decision === "DECLINED") {
    return {
      required: true,
      allowed: false,
      status: "DECLINED",
      consentRecordId: record.id || null,
      decisionEvidenceId: decision?.id || null,
      code: "CUSTOMER_RECORDING_DECLINED",
    };
  }
  if (!decision) {
    return {
      required: true,
      allowed: false,
      status: "REQUIRED",
      consentRecordId: record.id || null,
      decisionEvidenceId: null,
      code: "CUSTOMER_RECORDING_AUTH_REQUIRED",
    };
  }
  const expectedContent = permissionContentForAudio(Boolean(assessment.audioAllowed), false);
  const contentMatches = Boolean(
    record.contentVersion?.version === expectedContent.version &&
      record.contentVersion?.contentHash === expectedContent.contentHash &&
      record.contentVersion?.contentJson === expectedContent.contentJson &&
      decision.contentVersion === expectedContent.version &&
      decision.contentHash === expectedContent.contentHash,
  );
  const authority = storedAuthorityEvidenceIsCurrent({
    assessment,
    decisionEvidence: decision,
  });
  const allowed = Boolean(
    record.verifiedDecision === true &&
      String(record.status || "").toLowerCase() === "accepted" &&
      lifecycle === "ALLOWED" &&
      decision.decision === "ALLOWED" &&
      decision.scopeHash === assessment.scopeHash &&
      contentMatches &&
      authority.ok,
  );
  return {
    required: true,
    allowed,
    status: allowed ? "ALLOWED" : "STALE",
    consentRecordId: record.id || null,
    decisionEvidenceId: decision.id || null,
    code: allowed ? null : "CUSTOMER_RECORDING_EVIDENCE_STALE",
  };
}
