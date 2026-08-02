import { describe, expect, it } from "vitest";
import { resolveRecordingPermissionGate } from "./recording-gate";

const residenceScope = JSON.stringify({
  schemaVersion: "recording-scope-v1",
  recordingLocation: "residence",
  audioEnabled: false,
  initialAudience: "private",
});

describe("canonical recording permission gate", () => {
  it("keeps a declined residence request locked even when mutable metadata says business", () => {
    const gate = resolveRecordingPermissionGate({
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
      consentRecord: {
        id: "permission-1",
        status: "declined",
        lifecycleStatus: "DECLINED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        decisionEvidence: { id: "evidence-1" },
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
      consentRecord: {
        id: "permission-1",
        status: "accepted",
        lifecycleStatus: "ALLOWED",
        verifiedDecision: true,
        isCurrent: true,
        scopeJson: residenceScope,
        decisionEvidence: { id: "evidence-1" },
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
    });

    expect(gate).toMatchObject({
      permissionRequired: true,
      permissionState: "not_sent",
      recordingUnlocked: false,
      blockCode: "VERIFIED_PERMISSION_REQUIRED",
    });
  });
});
