import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadGate: vi.fn(),
  assertParticipation: vi.fn(),
  resolveSafety: vi.fn(),
  validateLocation: vi.fn(),
  prisma: { $transaction: vi.fn() },
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadGate,
}));
vi.mock("@/lib/employee-recording-participation", () => ({
  employeeRecordingParticipationContractEnabled: (metadata: string | null | undefined) =>
    String(metadata || "").includes("employee-recording-participation-v1"),
  assertEmployeeParticipationEvidenceCurrent: mocks.assertParticipation,
}));
vi.mock("@/lib/recording/employee-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recording/employee-safety")>(
    "@/lib/recording/employee-safety",
  );
  return { ...actual, resolveV2StageSafetyReadiness: mocks.resolveSafety };
});
vi.mock("@/lib/job-assignment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/job-assignment")>(
    "@/lib/job-assignment",
  );
  return { ...actual, validateRecordingLocationSnapshot: mocks.validateLocation };
});

import {
  assertMediaSessionAuthorizationCurrent,
  assertRecordingAuthorizationCurrent,
  EMPLOYEE_PARTICIPATION_GATE_EVIDENCE_VERSION,
  persistAllowedRecordingGateDecision,
  submitServiceVideoPackage,
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

function authorizationDb(
  evidence: any,
  contractVersion: string = RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
) {
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
    mocks.resolveSafety.mockReturnValue(safety);
    mocks.validateLocation.mockReturnValue({
      ok: true,
      snapshot: { snapshotEvidenceHash: "location-snapshot-hash" },
    });
    mocks.prisma.$transaction.mockReset();
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

  it("keeps V2 safety identity authoritative when participation evidence is also required", async () => {
    const combinedGate = {
      ...allowedGate,
      employeeParticipation: {
        required: true,
        complete: true,
        evidence: employeeParticipationEvidence,
      },
    };
    const create = vi.fn().mockImplementation(({ data }) => ({ id: "gate-combined-1", ...data }));
    const evidence = await persistAllowedRecordingGateDecision({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      actorKind: "EMPLOYEE",
      surface: "media_session",
      stage: "INTRO",
      gate: combinedGate as any,
      tx: { recordingGateDecisionEvidence: { create } },
    });
    const db = {
      ...authorizationDb(evidence),
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          customerMetadata: JSON.stringify({
            vendor_job_employee_recording_participation_contract_version:
              "employee-recording-participation-v1",
          }),
        }),
      },
    };
    mocks.loadGate.mockResolvedValue(combinedGate);

    expect(evidence).toMatchObject({
      evidenceVersion: V2_RECORDING_GATE_EVIDENCE_VERSION,
      safetyEvidenceId: "safety-1",
      employeeParticipationEvidenceJson: JSON.stringify(employeeParticipationEvidence),
    });
    await expect(assertRecordingAuthorizationCurrent(db, {
      gateDecisionId: "gate-combined-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      stage: "INTRO",
      surface: "upload_complete",
    })).resolves.toBe(evidence);
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

  it("blocks package submission when newer stage safety overrides the saved gate", async () => {
    const stageKeys = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;
    const stageRows = stageKeys.map((stage, index) => ({
      id: `stage-${index + 1}`,
      stage,
      stageVersion: 1,
      mediaAssetId: `asset-${index + 1}`,
      mediaSessionId: `session-${index + 1}`,
      assessmentId: "assessment-v2-1",
      assessmentGeneration: 2,
      permissionEvidenceId: "assessment-v2-1",
      recordingGateDecisionId: `gate-${index + 1}`,
      employeeMembershipId: "membership-1",
      captureProvenance: "LIVE_BROWSER_CAPTURE",
      contentHash: `content-${index + 1}`,
      publicEligible: true,
      uploadState: "SAVED",
      audioExpected: false,
      audioPresence: "ABSENT",
      audioEvidenceVersion: 2,
    }));
    const gates = new Map(stageRows.map((row, index) => [row.recordingGateDecisionId, {
      id: row.recordingGateDecisionId,
      assessmentId: "assessment-v2-1",
      assessmentGeneration: 2,
      scopeHash: allowedGate.scopeHash,
      assignmentGeneration: 4,
      certificationId: "certification-1",
      permissionEvidenceId: "assessment-v2-1",
      stage: row.stage,
      safetyEvidenceId: `safety-${index + 1}`,
      safetyEvidenceHash: `safety-hash-${index + 1}`,
      locationAttemptId: `location-${index + 1}`,
      locationAttemptEvidenceHash: `location-hash-${index + 1}`,
      audioExpected: false,
    }]));
    const safetyRows = new Map(stageRows.map((row, index) => [row.stage, [{
      id: `safety-${index + 1}`,
      evidenceHash: `safety-hash-${index + 1}`,
      locationAttemptId: `location-${index + 1}`,
      locationAttemptEvidenceHash: `location-hash-${index + 1}`,
    }]]));
    const tx: any = {
      recordingScopeAssessment: { findFirst: vi.fn().mockResolvedValue({
        id: "assessment-v2-1",
        generation: 2,
        contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
        scopeHash: allowedGate.scopeHash,
        scopeJson: "{}",
        locationType: "business",
        status: "COMPLETE",
      }) },
      booking: { findFirst: vi.fn().mockResolvedValue({
        customerMetadata: JSON.stringify({
          vendor_job_assigned_membership_ids: ["membership-1"],
          vendor_job_assignment_generation: 4,
        }),
      }) },
      serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stageRows) },
      recordingGateDecisionEvidence: {
        findFirst: vi.fn().mockImplementation(({ where }) => gates.get(where.id)),
      },
      employeeRecordingSafetyEvidence: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          const serviceStage = where.stage === "STARTING_CONDITION"
            ? "INTRO"
            : where.stage === "WORK_IN_PROGRESS"
              ? "IN_PROGRESS"
              : "COMPLETED";
          return safetyRows.get(serviceStage) || [];
        }),
      },
      mediaAsset: { findFirst: vi.fn().mockImplementation(({ where }) => {
        const row = stageRows.find((candidate) => candidate.mediaAssetId === where.id)!;
        return { ...row };
      }) },
      mediaSession: { findFirst: vi.fn().mockResolvedValue({ status: "COMPLETED", audioExpected: false }) },
      serviceVideoPackageEvidence: { create: vi.fn() },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: (db: any) => unknown) => callback(tx));
    mocks.loadGate.mockImplementation(async ({ recordingStage }) => ({
      ...allowedGate,
      v2Safety: { ...safety, evidenceId: `safety-${stageKeys.indexOf(recordingStage) + 1}` },
    }));
    mocks.resolveSafety
      .mockReturnValueOnce({ ...safety, evidenceId: "safety-1" })
      .mockReturnValueOnce({ ...safety, evidenceId: "safety-2" })
      .mockReturnValueOnce({
        ...safety,
        ready: false,
        result: "BLOCKED",
        code: "V2_RUNTIME_SAFETY_BLOCKED",
        evidenceId: "safety-newer-blocked",
      });

    await expect(submitServiceVideoPackage({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      submittedByMembershipId: "membership-1",
    })).rejects.toMatchObject({ code: "V2_RUNTIME_SAFETY_BLOCKED" });
    expect(tx.serviceVideoPackageEvidence.create).not.toHaveBeenCalled();
  });
});
