import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadGate: vi.fn(),
  assertParticipation: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadGate,
}));
vi.mock("@/lib/employee-recording-participation", () => ({
  employeeRecordingParticipationContractEnabled: (metadata: string | null | undefined) =>
    String(metadata || "").includes("employee-recording-participation-v1"),
  assertEmployeeParticipationEvidenceCurrent: mocks.assertParticipation,
}));

import {
  assertMediaSessionAuthorizationCurrent,
  assertRecordingAuthorizationCurrent,
  EMPLOYEE_PARTICIPATION_GATE_EVIDENCE_VERSION,
  persistAllowedRecordingGateDecision,
  V2_RECORDING_GATE_EVIDENCE_VERSION,
} from "./service-video-evidence";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "./recording/assessment-v2";

const safety = {
  required: true,
  ready: true,
  code: null,
  result: "READY",
  evidenceId: "safety-1",
  evidenceHash: "a".repeat(64),
  locationAttemptId: "location-attempt-1",
  locationAttemptEvidenceHash: "b".repeat(64),
  stage: "STARTING_CONDITION",
  checkType: "INITIAL",
};

const allowedGate = {
  blockCode: null,
  recordingUnlocked: true,
  releaseAllowed: true,
  assessmentId: "assessment-v2-1",
  assessmentGeneration: 2,
  assessmentContractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  scopeHash: "c".repeat(64),
  certificationId: "certification-1",
  assignmentGeneration: 4,
  permissionRequired: false,
  permissionDecisionEvidenceId: null,
  consentRecordId: null,
  locationAttemptId: "location-attempt-1",
  locationExceptionId: null,
  audioAllowed: false,
  v2Safety: safety,
};

const employeeParticipationEvidence = [{
  membershipId: "membership-1",
  membershipGeneration: 2,
  decisionId: "participation-1",
  decisionEvidenceHash: "d".repeat(64),
  decisionVersion: 1,
  assignmentGeneration: 4,
  assessmentGeneration: 2,
}];

const participationGate = {
  ...allowedGate,
  assessmentContractVersion: "recording-assessment-v3-package-audio-v1",
  v2Safety: null,
  employeeParticipation: {
    required: true,
    complete: true,
    evidence: employeeParticipationEvidence,
  },
};

async function persistedEvidence() {
  const create = vi.fn().mockImplementation(({ data }) => ({ id: "gate-1", ...data }));
  const evidence = await persistAllowedRecordingGateDecision({
    bookingId: "booking-1",
    vendorId: "vendor-1",
    membershipId: "membership-1",
    actorKind: "EMPLOYEE",
    surface: "media_session",
    stage: "INTRO",
    gate: allowedGate as any,
    tx: { recordingGateDecisionEvidence: { create } },
  });
  return { evidence, create };
}

async function persistedParticipationEvidence() {
  const create = vi.fn().mockImplementation(({ data }) => ({ id: "gate-participation-1", ...data }));
  const evidence = await persistAllowedRecordingGateDecision({
    bookingId: "booking-1",
    vendorId: "vendor-1",
    membershipId: "membership-1",
    actorKind: "EMPLOYEE",
    surface: "media_session",
    stage: "INTRO",
    gate: participationGate as any,
    tx: { recordingGateDecisionEvidence: { create } },
  });
  return { evidence, create };
}

function authorizationDb(evidence: any, contractVersion = RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
  return {
    recordingGateDecisionEvidence: { findFirst: vi.fn().mockResolvedValue(evidence) },
    recordingScopeAssessment: { findFirst: vi.fn().mockResolvedValue({ contractVersion }) },
    booking: { findFirst: vi.fn().mockResolvedValue({ customerMetadata: "{}" }) },
    vendorMembership: { findFirst: vi.fn().mockResolvedValue({ id: "membership-1" }) },
  };
}

describe("V2 recording authorization evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGate.mockResolvedValue(allowedGate);
    mocks.assertParticipation.mockResolvedValue({ required: true, complete: true });
  });

  it("persists the exact stage, safety, and GPS evidence used by the gate", async () => {
    const { evidence, create } = await persistedEvidence();

    expect(evidence).toMatchObject({
      evidenceVersion: V2_RECORDING_GATE_EVIDENCE_VERSION,
      stage: "INTRO",
      safetyEvidenceId: "safety-1",
      safetyEvidenceHash: safety.evidenceHash,
      locationAttemptId: "location-attempt-1",
      locationAttemptEvidenceHash: safety.locationAttemptEvidenceHash,
      assessmentGeneration: 2,
      assignmentGeneration: 4,
    });
    expect(create).toHaveBeenCalledOnce();
    expect(evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persists the exact ordered Employee participation evidence used by the gate", async () => {
    const { evidence } = await persistedParticipationEvidence();

    expect(evidence).toMatchObject({
      evidenceVersion: EMPLOYEE_PARTICIPATION_GATE_EVIDENCE_VERSION,
      stage: "INTRO",
      employeeParticipationEvidenceJson: JSON.stringify(employeeParticipationEvidence),
    });
    expect(evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects media mutation when exact Employee participation evidence becomes stale", async () => {
    const { evidence } = await persistedParticipationEvidence();
    const db = {
      ...authorizationDb(evidence, "recording-assessment-v3-package-audio-v1"),
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          customerMetadata: JSON.stringify({
            vendor_job_employee_recording_participation_contract_version:
              "employee-recording-participation-v1",
          }),
        }),
      },
    };
    mocks.assertParticipation.mockRejectedValue(
      new Error("EMPLOYEE_RECORDING_PARTICIPATION_STALE"),
    );

    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-participation-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_complete",
    })).rejects.toMatchObject({ code: "EMPLOYEE_RECORDING_PARTICIPATION_STALE" });
    expect(mocks.loadGate).not.toHaveBeenCalled();
  });

  it("accepts only the still-current exact evidence identity", async () => {
    const { evidence } = await persistedEvidence();
    const db = authorizationDb(evidence);

    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_init",
    })).resolves.toBe(evidence);
  });

  it.each([
    ["newer blocked safety", { blockCode: "V2_RUNTIME_SAFETY_BLOCKED", recordingUnlocked: false }],
    ["newer material safety", { blockCode: "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED", recordingUnlocked: false }],
    ["replacement safety evidence", { v2Safety: { ...safety, evidenceId: "safety-2" } }],
    ["new assignment generation", { assignmentGeneration: 5 }],
    ["new assessment generation", { assessmentGeneration: 3 }],
    ["replacement GPS evidence", { locationAttemptId: "location-attempt-2" }],
  ])("rejects an old authorization after %s", async (_label, gateChange) => {
    const { evidence } = await persistedEvidence();
    const db = authorizationDb(evidence);
    mocks.loadGate.mockResolvedValue({ ...allowedGate, ...gateChange });

    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_complete",
    })).rejects.toMatchObject({ code: "V2_RECORDING_AUTHORIZATION_STALE" });
  });

  it("rejects cross-stage reuse before re-evaluating the gate", async () => {
    const { evidence } = await persistedEvidence();
    const db = authorizationDb(evidence);

    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "IN_PROGRESS",
      surface: "upload_init",
    })).rejects.toMatchObject({ code: "V2_RECORDING_AUTHORIZATION_EVIDENCE_INVALID" });
    expect(mocks.loadGate).not.toHaveBeenCalled();
  });

  it("rejects a gate row whose fields no longer match its immutable snapshot", async () => {
    const { evidence } = await persistedEvidence();
    const db = authorizationDb({ ...evidence, safetyEvidenceId: "safety-tampered" });

    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_init",
    })).rejects.toMatchObject({ code: "V2_RECORDING_AUTHORIZATION_EVIDENCE_INVALID" });
    expect(mocks.loadGate).not.toHaveBeenCalled();
  });

  it("preserves V3 sessions without imposing V2-only evidence bindings", async () => {
    const db = {
      mediaSession: { findFirst: vi.fn().mockResolvedValue({ recordingGateDecisionId: null }) },
      recordingScopeAssessment: {
        findFirst: vi.fn().mockResolvedValue({ contractVersion: "recording-assessment-v3-package-audio-v1" }),
      },
    };

    await expect(assertMediaSessionAuthorizationCurrent(db, {
      mediaSessionId: "legacy-session",
      bookingId: "booking-legacy",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_init",
    })).resolves.toMatchObject({ recordingGateDecisionId: null });
  });

  it("fails closed when a V2 media session lacks exact authorization evidence", async () => {
    const db = {
      mediaSession: { findFirst: vi.fn().mockResolvedValue({ recordingGateDecisionId: null }) },
      recordingScopeAssessment: {
        findFirst: vi.fn().mockResolvedValue({ contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION }),
      },
    };

    await expect(assertMediaSessionAuthorizationCurrent(db, {
      mediaSessionId: "v2-session",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_status",
    })).rejects.toMatchObject({ code: "RECORDING_SESSION_AUTHORIZATION_NOT_FOUND" });
  });
});
