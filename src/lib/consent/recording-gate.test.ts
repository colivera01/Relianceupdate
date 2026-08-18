import { describe, expect, it } from "vitest";
import { resolveRecordingPermissionGate } from "./recording-gate";
import { buildStoredAuthorityEvidence, evaluatePermissionAuthority } from "./authority-validation";

const residenceScope = JSON.stringify({
  schemaVersion: "recording-scope-v1",
  recordingLocation: "residence",
  audioEnabled: false,
  initialAudience: "private",
});

const assessment = {
  id: "assessment-1",
  generation: 1,
  authorityHolderType: "customer",
  locationType: "residence",
  permissionRequired: true,
  scopeHash: "scope-hash-1",
};
const authorityValidation = evaluatePermissionAuthority({
  assessment,
  claimedRole: "customer",
  authorityScope: "self_and_property",
  verificationMethod: "email_otp",
  verifiedContactHash: "verified-contact-hash",
});
const authorityEvidence = buildStoredAuthorityEvidence({ assessment, validation: authorityValidation });
const decisionEvidence = {
  id: "evidence-1",
  claimedRole: "customer",
  authorityScope: "self_and_property",
  verificationMethod: "email_otp",
  verifiedContactHash: "verified-contact-hash",
  scopeHash: "scope-hash-1",
  metadata: JSON.stringify({ authority: authorityEvidence }),
};

describe("canonical recording permission gate", () => {
  it("keeps a declined residence request locked even when mutable metadata says business", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
      assessment,
      consentRecord: {
        id: "permission-1",
        status: "declined",
        lifecycleStatus: "DECLINED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        scopeHash: "scope-hash-1",
        decisionEvidence,
      },
    });

    expect(gate).toMatchObject({
      location: "residence",
      permissionRequired: true,
      permissionState: "declined",
      recordingUnlocked: false,
      verifiedAllowed: false,
      blockCode: "VERIFIED_PERMISSION_REQUIRED",
    });
  });

  it("unlocks only a current allowed decision with durable decision evidence", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
      assessment,
      consentRecord: {
        id: "permission-1",
        status: "accepted",
        lifecycleStatus: "ALLOWED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        scopeHash: "scope-hash-1",
        decisionEvidence,
      },
    });

    expect(gate).toMatchObject({
      location: "residence",
      permissionRequired: true,
      permissionState: "allowed",
      recordingUnlocked: true,
      verifiedAllowed: true,
      blockCode: null,
    });
  });

  it("fails closed when an allowed status has no decision evidence", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "residence" }),
      assessment,
      consentRecord: {
        id: "permission-1",
        status: "accepted",
        lifecycleStatus: "ALLOWED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        decisionEvidence: null,
      },
    });

    expect(gate.recordingUnlocked).toBe(false);
    expect(gate.permissionState).toBe("pending");
  });

  it("allows a vendor-business record with no permission request", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
      consentRecord: null,
      assessment: { ...assessment, locationType: "business", permissionRequired: false },
    });

    expect(gate).toMatchObject({
      location: "business",
      permissionRequired: false,
      permissionState: "not_required",
      recordingUnlocked: true,
      blockCode: null,
    });
  });

  it("locks a residence record when no current permission request exists", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "residence" }),
      consentRecord: null,
      assessment,
    });

    expect(gate).toMatchObject({
      permissionRequired: true,
      permissionState: "not_sent",
      recordingUnlocked: false,
      blockCode: "VERIFIED_PERMISSION_REQUIRED",
    });
  });

  it("fails closed when an allowed record contains only legacy decision evidence", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "residence" }),
      assessment,
      consentRecord: {
        id: "permission-1",
        status: "accepted",
        lifecycleStatus: "ALLOWED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        scopeHash: "scope-hash-1",
        decisionEvidence: { id: "legacy-evidence" },
      },
    });

    expect(gate).toMatchObject({
      recordingUnlocked: false,
      verifiedAllowed: false,
      blockCode: "PERMISSION_AUTHORITY_INVALID",
    });
  });
});
