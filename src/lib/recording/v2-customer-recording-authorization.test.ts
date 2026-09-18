import { describe, expect, it } from "vitest";

import { buildStoredAuthorityEvidence, evaluatePermissionAuthority } from "@/lib/consent/authority-validation";
import { permissionContentForAudio } from "@/lib/consent/content-version";
import { parseRecordingAssessmentV2, RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "./assessment-v2";
import { resolveV2CustomerRecordingAuthorization } from "./v2-customer-recording-authorization";

function fixture() {
  const canonical = parseRecordingAssessmentV2({
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location: { type: "CUSTOMER_RESIDENCE", snapshotEvidenceHash: "a".repeat(64) },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["CUSTOMER"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
  });
  const assessment = {
    id: "assessment-v2-1",
    generation: 4,
    isCurrent: true,
    status: "COMPLETE",
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    authorityHolderType: "CUSTOMER",
    locationType: "residence",
    scopeHash: canonical.scopeHash,
    permissionRequired: true,
    audioAllowed: false,
  };
  const validation = evaluatePermissionAuthority({
    assessment,
    claimedRole: "customer",
    authorityScope: "self_and_property",
    verificationMethod: "email_otp",
    verifiedContactHash: "contact-hash",
  });
  const authority = buildStoredAuthorityEvidence({ assessment, validation });
  const content = permissionContentForAudio(false, false);
  const decisionEvidence = {
    id: "customer-decision-1",
    decision: "ALLOWED",
    claimedRole: "customer",
    authorityScope: "self_and_property",
    verificationMethod: "email_otp",
    verifiedContactHash: "contact-hash",
    scopeHash: canonical.scopeHash,
    contentHash: content.contentHash,
    contentVersion: content.version,
    metadata: JSON.stringify({ authority }),
  };
  const consentRecord = {
    id: "consent-1",
    isCurrent: true,
    supersededAt: null,
    status: "accepted",
    lifecycleStatus: "ALLOWED",
    verifiedDecision: true,
    recipientMismatch: false,
    scopeHash: canonical.scopeHash,
    scopeJson: JSON.stringify({
      ...JSON.parse(canonical.scopeJson),
      recordingAssessmentId: assessment.id,
      recordingAssessmentGeneration: assessment.generation,
    }),
    contentVersion: {
      version: content.version,
      contentHash: content.contentHash,
      contentJson: content.contentJson,
    },
    decisionEvidence,
  };
  return { assessment, consentRecord, decisionEvidence, content };
}

describe("V2 Customer recording authorization evidence", () => {
  it("allows only the exact assessment, generation, scope, text, and verified authority", () => {
    expect(resolveV2CustomerRecordingAuthorization(fixture())).toMatchObject({
      required: true,
      allowed: true,
      status: "ALLOWED",
      consentRecordId: "consent-1",
      decisionEvidenceId: "customer-decision-1",
    });
  });

  it.each([
    ["assessment generation", (state: ReturnType<typeof fixture>) => {
      state.assessment.generation += 1;
    }, "SCOPE_STALE"],
    ["scope hash", (state: ReturnType<typeof fixture>) => {
      state.assessment.scopeHash = "b".repeat(64);
    }, "SCOPE_STALE"],
    ["displayed scope", (state: ReturnType<typeof fixture>) => {
      const scope = JSON.parse(state.consentRecord.scopeJson);
      scope.recordingArea = { boundary: "NECESSARY_SURROUNDINGS", explanation: "Expanded" };
      state.consentRecord.scopeJson = JSON.stringify(scope);
    }, "SCOPE_STALE"],
    ["content text hash", (state: ReturnType<typeof fixture>) => {
      state.consentRecord.contentVersion.contentHash = "c".repeat(64);
    }, "CUSTOMER_RECORDING_EVIDENCE_STALE"],
    ["decision value", (state: ReturnType<typeof fixture>) => {
      state.consentRecord.decisionEvidence.decision = "DECLINED";
    }, "CUSTOMER_RECORDING_DECLINED"],
    ["verified authority", (state: ReturnType<typeof fixture>) => {
      state.consentRecord.decisionEvidence.metadata = "{}";
    }, "CUSTOMER_RECORDING_EVIDENCE_STALE"],
  ])("fails closed when %s changes", (_label, mutate, code) => {
    const state = fixture();
    mutate(state);
    expect(resolveV2CustomerRecordingAuthorization(state)).toMatchObject({
      allowed: false,
      code,
    });
  });

  it("keeps wrong-recipient distinct from decline", () => {
    const state = fixture();
    state.consentRecord.recipientMismatch = true;
    expect(resolveV2CustomerRecordingAuthorization(state)).toMatchObject({
      allowed: false,
      status: "WRONG_RECIPIENT",
      code: "CUSTOMER_RECORDING_RECIPIENT_CORRECTION_REQUIRED",
    });
  });

  it("does not require a Customer decision for a canonical vendor-authorized V2 scope", () => {
    const state = fixture();
    state.assessment.permissionRequired = false;
    expect(resolveV2CustomerRecordingAuthorization({
      assessment: state.assessment,
      consentRecord: null,
    })).toMatchObject({ required: false, allowed: true, status: "NOT_REQUIRED" });
  });
});
