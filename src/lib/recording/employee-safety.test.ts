import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION,
  EmployeeRecordingSafetyValidationError,
  parseEmployeeRecordingSafetyEvidence,
  resolveV2StageSafetyReadiness,
  type CanonicalEmployeeRecordingSafetyEvidence,
  type StoredEmployeeRecordingSafetyEvidence,
} from "./employee-safety";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
} from "./assessment-v2";

const LOCATION_HASH = "a".repeat(64);
const OTHER_LOCATION_HASH = "b".repeat(64);
const ASSESSMENT_HASH = "9eddf097df685ac4bb41fc6985ba59d7a4a5936e1ec5916d25ba1da1f1be35c6";
const SAFETY_HASH_A = "93a25638f4e18065493ed1e0d174c11b6dfb0c2c8c0e76db7f6070de7c548bf8";
const SAFETY_HASH_B = "2e5f8c88499495479d2eda30f300309253fb5eb631a437defb2211d5196cdb80";

function safetyFixture(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION,
    sequence: 1,
    workRecord: { bookingId: "booking-v2-a", vendorId: "vendor-v2-a" },
    assessment: {
      id: "assessment-v2-a",
      generation: 2,
      contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      scopeHash: ASSESSMENT_HASH,
    },
    location: { snapshotEvidenceHash: LOCATION_HASH },
    employee: { membershipId: "membership-employee-a", assignmentGeneration: 3 },
    check: { type: "INITIAL", stage: "STARTING_CONDITION" },
    issues: [],
    result: "READY",
    predecessor: null,
    createdAt: "2026-08-27T20:00:00.000Z",
    ...overrides,
  };
}

function expectValidationCode(input: unknown, code: string) {
  try {
    parseEmployeeRecordingSafetyEvidence(input);
    throw new Error("Expected employee safety validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(EmployeeRecordingSafetyValidationError);
    expect((error as EmployeeRecordingSafetyValidationError).code).toBe(code);
  }
}

function stored(
  id: string,
  parsed: CanonicalEmployeeRecordingSafetyEvidence,
  overrides: Partial<StoredEmployeeRecordingSafetyEvidence> = {},
): StoredEmployeeRecordingSafetyEvidence {
  const evidence = parsed.evidence;
  return {
    id,
    bookingId: evidence.workRecord.bookingId,
    vendorId: evidence.workRecord.vendorId,
    assessmentId: evidence.assessment.id,
    assessmentGeneration: evidence.assessment.generation,
    assessmentContractVersion: evidence.assessment.contractVersion,
    assessmentScopeHash: evidence.assessment.scopeHash,
    locationSnapshotEvidenceHash: evidence.location.snapshotEvidenceHash,
    membershipId: evidence.employee.membershipId,
    assignmentGeneration: evidence.employee.assignmentGeneration,
    safetyContractVersion: evidence.contractVersion,
    checkType: evidence.check.type,
    stage: evidence.check.stage,
    result: evidence.result,
    issueCodesJson: parsed.issueCodesJson,
    sequence: evidence.sequence,
    predecessorEvidenceId: evidence.predecessor?.id || null,
    predecessorEvidenceHash: evidence.predecessor?.evidenceHash || null,
    canonicalJson: parsed.canonicalJson,
    evidenceHash: parsed.evidenceHash,
    createdAt: evidence.createdAt,
    ...overrides,
  };
}

const v2AssessmentFixture = parseRecordingAssessmentV2({
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash: LOCATION_HASH },
  intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
  expectedPeople: ["NO_IDENTIFIABLE_PEOPLE"],
  recordingFormat: "VIDEO_ONLY",
  recordingArea: { boundary: "SERVICE_AREA_ONLY" },
});

const currentAssessment = {
  id: "assessment-v2-a",
  generation: 2,
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  scopeHash: v2AssessmentFixture.scopeHash,
  scopeJson: v2AssessmentFixture.scopeJson,
  status: "COMPLETE",
};

function readiness(
  evidence: StoredEmployeeRecordingSafetyEvidence[],
  overrides: Record<string, unknown> = {},
) {
  return resolveV2StageSafetyReadiness({
    bookingId: "booking-v2-a",
    vendorId: "vendor-v2-a",
    assessment: currentAssessment,
    membershipId: "membership-employee-a",
    assignmentGeneration: 3,
    locationSnapshotEvidenceHash: LOCATION_HASH,
    recordingStage: "INTRO",
    evidence,
    ...overrides,
  } as any);
}

describe("employee runtime-safety canonical contract", () => {
  it("accepts READY with no issues and includes all authoritative bindings", () => {
    const result = parseEmployeeRecordingSafetyEvidence(safetyFixture());
    expect(result.evidence).toMatchObject({
      contractVersion: EMPLOYEE_RECORDING_SAFETY_CONTRACT_VERSION,
      assessment: {
        id: "assessment-v2-a",
        generation: 2,
        contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
        scopeHash: ASSESSMENT_HASH,
      },
      workRecord: { bookingId: "booking-v2-a", vendorId: "vendor-v2-a" },
      location: { snapshotEvidenceHash: LOCATION_HASH },
      employee: { membershipId: "membership-employee-a", assignmentGeneration: 3 },
      check: { type: "INITIAL", stage: "STARTING_CONDITION" },
      issues: [],
      result: "READY",
    });
  });

  it("accepts BLOCKED with one or several finite issue codes", () => {
    const single = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({ issues: ["MINOR_PRESENT"], result: "BLOCKED" }),
    );
    const several = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        issues: ["PRIVATE_DOCUMENT_OR_SCREEN", "UNEXPECTED_ADULT_PERSON"],
        result: "BLOCKED",
      }),
    );
    expect(single.evidence.issues).toEqual(["MINOR_PRESENT"]);
    expect(several.evidence.issues).toEqual([
      "UNEXPECTED_ADULT_PERSON",
      "PRIVATE_DOCUMENT_OR_SCREEN",
    ]);
  });

  it("sorts issues by contract order so input order does not affect the hash", () => {
    const first = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        issues: ["PRIVATE_DOCUMENT_OR_SCREEN", "UNEXPECTED_ADULT_PERSON"],
        result: "BLOCKED",
      }),
    );
    const second = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        issues: ["UNEXPECTED_ADULT_PERSON", "PRIVATE_DOCUMENT_OR_SCREEN"],
        result: "BLOCKED",
      }),
    );
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.evidenceHash).toBe(second.evidenceHash);
  });

  it("rejects duplicate and unknown issue codes", () => {
    expectValidationCode(
      safetyFixture({ issues: ["MINOR_PRESENT", "MINOR_PRESENT"], result: "BLOCKED" }),
      "DUPLICATE_ISSUE",
    );
    expectValidationCode(
      safetyFixture({ issues: ["EMPLOYEE_ACKNOWLEDGED_RISK"], result: "BLOCKED" }),
      "UNKNOWN_ENUM_VALUE",
    );
  });

  it("enforces READY, BLOCKED, and material-scope result invariants", () => {
    expectValidationCode(
      safetyFixture({ issues: ["MINOR_PRESENT"], result: "READY" }),
      "READY_WITH_ISSUES",
    );
    expectValidationCode(safetyFixture({ result: "BLOCKED" }), "BLOCKED_WITHOUT_ISSUES");
    expectValidationCode(
      safetyFixture({
        issues: ["MATERIAL_SCOPE_EXPANSION_REQUIRED"],
        result: "BLOCKED",
      }),
      "MATERIAL_RESULT_REQUIRED",
    );
    expectValidationCode(
      safetyFixture({
        issues: ["APPROVED_AUDIO_SCOPE_MISMATCH"],
        result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
      }),
      "MATERIAL_ISSUE_REQUIRED",
    );
    expect(
      parseEmployeeRecordingSafetyEvidence(
        safetyFixture({
          issues: [
            "APPROVED_AUDIO_SCOPE_MISMATCH",
            "MATERIAL_SCOPE_EXPANSION_REQUIRED",
          ],
          result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
        }),
      ).evidence.result,
    ).toBe("MATERIAL_SCOPE_CHANGE_REQUIRED");
  });

  it("rejects unknown results and contract versions", () => {
    expectValidationCode(safetyFixture({ result: "ACKNOWLEDGED" }), "UNKNOWN_ENUM_VALUE");
    expectValidationCode(
      safetyFixture({ contractVersion: "employee-safety-latest" }),
      "CONTRACT_VERSION_MISMATCH",
    );
  });

  it("requires the approved stage/check pair", () => {
    expectValidationCode(
      safetyFixture({ check: { type: "STAGE_RECHECK", stage: "STARTING_CONDITION" } }),
      "CHECK_STAGE_MISMATCH",
    );
    expectValidationCode(
      safetyFixture({ check: { type: "INITIAL", stage: "WORK_IN_PROGRESS" } }),
      "CHECK_STAGE_MISMATCH",
    );
  });

  it("requires a predecessor on every recheck sequence and forbids one on sequence one", () => {
    expectValidationCode(
      safetyFixture({ sequence: 2 }),
      "PREDECESSOR_SEQUENCE_MISMATCH",
    );
    expectValidationCode(
      safetyFixture({
        predecessor: { id: "evidence-before-first", evidenceHash: "c".repeat(64) },
      }),
      "PREDECESSOR_SEQUENCE_MISMATCH",
    );
  });

  it("changes hashes for stage, employee, assessment, location, and contract bindings", () => {
    const base = parseEmployeeRecordingSafetyEvidence(safetyFixture()).evidenceHash;
    const variants = [
      safetyFixture({ workRecord: { bookingId: "booking-v2-other", vendorId: "vendor-v2-a" } }),
      safetyFixture({ employee: { membershipId: "membership-other", assignmentGeneration: 3 } }),
      safetyFixture({ assessment: { ...safetyFixture().assessment, scopeHash: "c".repeat(64) } }),
      safetyFixture({ location: { snapshotEvidenceHash: OTHER_LOCATION_HASH } }),
      safetyFixture({
        check: { type: "STAGE_RECHECK", stage: "WORK_IN_PROGRESS" },
      }),
    ];
    for (const fixture of variants) {
      expect(parseEmployeeRecordingSafetyEvidence(fixture).evidenceHash).not.toBe(base);
    }
  });

  it("matches fixed safety golden fixture A", () => {
    const result = parseEmployeeRecordingSafetyEvidence(safetyFixture());
    expect(result.canonicalJson).toBe(
      '{"assessment":{"contractVersion":"recording-assessment-v4-multiscope-safety-v1","generation":2,"id":"assessment-v2-a","scopeHash":"9eddf097df685ac4bb41fc6985ba59d7a4a5936e1ec5916d25ba1da1f1be35c6"},"check":{"stage":"STARTING_CONDITION","type":"INITIAL"},"contractVersion":"employee-pre-recording-safety-v1","createdAt":"2026-08-27T20:00:00.000Z","employee":{"assignmentGeneration":3,"membershipId":"membership-employee-a"},"issues":[],"location":{"snapshotEvidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"predecessor":null,"result":"READY","sequence":1,"workRecord":{"bookingId":"booking-v2-a","vendorId":"vendor-v2-a"}}',
    );
    expect(result.evidenceHash).toBe(SAFETY_HASH_A);
  });

  it("matches fixed safety golden fixture B", () => {
    const result = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 2,
        check: { type: "STAGE_RECHECK", stage: "WORK_IN_PROGRESS" },
        issues: ["PRIVATE_DOCUMENT_OR_SCREEN", "UNEXPECTED_ADULT_PERSON"],
        result: "BLOCKED",
        predecessor: { id: "safety-evidence-a", evidenceHash: SAFETY_HASH_A },
        createdAt: "2026-08-27T20:05:00.000Z",
      }),
    );
    expect(result.canonicalJson).toBe(
      '{"assessment":{"contractVersion":"recording-assessment-v4-multiscope-safety-v1","generation":2,"id":"assessment-v2-a","scopeHash":"9eddf097df685ac4bb41fc6985ba59d7a4a5936e1ec5916d25ba1da1f1be35c6"},"check":{"stage":"WORK_IN_PROGRESS","type":"STAGE_RECHECK"},"contractVersion":"employee-pre-recording-safety-v1","createdAt":"2026-08-27T20:05:00.000Z","employee":{"assignmentGeneration":3,"membershipId":"membership-employee-a"},"issues":["UNEXPECTED_ADULT_PERSON","PRIVATE_DOCUMENT_OR_SCREEN"],"location":{"snapshotEvidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"predecessor":{"evidenceHash":"93a25638f4e18065493ed1e0d174c11b6dfb0c2c8c0e76db7f6070de7c548bf8","id":"safety-evidence-a"},"result":"BLOCKED","sequence":2,"workRecord":{"bookingId":"booking-v2-a","vendorId":"vendor-v2-a"}}',
    );
    expect(result.evidenceHash).toBe(SAFETY_HASH_B);
  });
});

describe("V2 stage safety readiness", () => {
  const readyInitial = parseEmployeeRecordingSafetyEvidence(safetyFixture());

  it("requires evidence for V2 but not current V3 or legacy assessments", () => {
    expect(readiness([])).toMatchObject({
      required: true,
      ready: false,
      code: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
    });
    expect(
      readiness([], {
        assessment: { ...currentAssessment, contractVersion: "recording-assessment-v3-package-audio-v1" },
      }),
    ).toEqual({
      required: false,
      ready: true,
      code: null,
      result: null,
      evidenceId: null,
      evidenceHash: null,
      stage: null,
      checkType: null,
    });
    expect(readiness([], { assessment: { ...currentAssessment, contractVersion: null } }).required).toBe(false);
  });

  it("accepts only a current matching READY initial check", () => {
    expect(readiness([stored("safety-a", readyInitial)])).toMatchObject({
      required: true,
      ready: true,
      result: "READY",
      evidenceId: "safety-a",
      stage: "STARTING_CONDITION",
      checkType: "INITIAL",
    });
  });

  it.each([
    ["wrong employee", { membershipId: "membership-other" }],
    ["wrong location", { locationSnapshotEvidenceHash: OTHER_LOCATION_HASH }],
    ["wrong assessment hash", { assessmentScopeHash: "c".repeat(64) }],
    ["wrong assessment generation", { assessmentGeneration: 1 }],
    ["stale assignment", { assignmentGeneration: 2 }],
  ])("rejects a READY check with %s", (_label, rowOverride) => {
    const row = stored("safety-stale", readyInitial, rowOverride as any);
    expect(readiness([row])).toMatchObject({
      ready: false,
      code: "V2_RUNTIME_SAFETY_BINDING_STALE",
    });
  });

  it("rejects corrupted canonical or hash evidence", () => {
    const row = stored("safety-corrupt", readyInitial, { evidenceHash: "d".repeat(64) });
    expect(readiness([row])).toMatchObject({
      ready: false,
      code: "V2_RUNTIME_SAFETY_EVIDENCE_INVALID",
    });
  });

  it("does not reuse Starting Condition READY for later stages", () => {
    expect(
      readiness([stored("safety-a", readyInitial)], { recordingStage: "IN_PROGRESS" }),
    ).toMatchObject({
      ready: false,
      code: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
      stage: "WORK_IN_PROGRESS",
      checkType: "STAGE_RECHECK",
    });
    expect(
      readiness([stored("safety-a", readyInitial)], { recordingStage: "COMPLETED" }),
    ).toMatchObject({
      ready: false,
      code: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
      stage: "COMPLETED_WORK",
    });
  });

  it("requires independent Work In Progress and Completed Work rechecks", () => {
    const work = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        check: { type: "STAGE_RECHECK", stage: "WORK_IN_PROGRESS" },
      }),
    );
    const completed = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        check: { type: "STAGE_RECHECK", stage: "COMPLETED_WORK" },
      }),
    );
    expect(
      readiness([stored("safety-work", work)], { recordingStage: "IN_PROGRESS" }),
    ).toMatchObject({ ready: true, evidenceId: "safety-work" });
    expect(
      readiness([stored("safety-work", work)], { recordingStage: "COMPLETED" }),
    ).toMatchObject({ ready: false, code: "V2_RUNTIME_SAFETY_CHECK_REQUIRED" });
    expect(
      readiness([stored("safety-complete", completed)], { recordingStage: "COMPLETED" }),
    ).toMatchObject({ ready: true, evidenceId: "safety-complete" });
  });

  it("gives the latest BLOCKED check precedence over an older READY", () => {
    const blocked = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 2,
        issues: ["MINOR_PRESENT"],
        result: "BLOCKED",
        predecessor: { id: "safety-ready", evidenceHash: readyInitial.evidenceHash },
        createdAt: "2026-08-27T20:10:00.000Z",
      }),
    );
    expect(
      readiness([stored("safety-ready", readyInitial), stored("safety-blocked", blocked)]),
    ).toMatchObject({
      ready: false,
      result: "BLOCKED",
      evidenceId: "safety-blocked",
      code: "V2_RUNTIME_SAFETY_BLOCKED",
    });
  });

  it("allows a later matching READY to restore readiness after remediation", () => {
    const blocked = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 2,
        issues: ["PRIVATE_DOCUMENT_OR_SCREEN"],
        result: "BLOCKED",
        predecessor: { id: "safety-ready", evidenceHash: readyInitial.evidenceHash },
        createdAt: "2026-08-27T20:10:00.000Z",
      }),
    );
    const restored = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 3,
        predecessor: { id: "safety-blocked", evidenceHash: blocked.evidenceHash },
        createdAt: "2026-08-27T20:15:00.000Z",
      }),
    );
    expect(
      readiness([
        stored("safety-ready", readyInitial),
        stored("safety-blocked", blocked),
        stored("safety-restored", restored),
      ]),
    ).toMatchObject({ ready: true, evidenceId: "safety-restored", result: "READY" });
  });

  it("does not let an older READY bypass material scope change evidence", () => {
    const material = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 2,
        issues: [
          "APPROVED_AUDIO_SCOPE_MISMATCH",
          "MATERIAL_SCOPE_EXPANSION_REQUIRED",
        ],
        result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
        predecessor: { id: "safety-ready", evidenceHash: readyInitial.evidenceHash },
        createdAt: "2026-08-27T20:10:00.000Z",
      }),
    );
    expect(
      readiness([stored("safety-ready", readyInitial), stored("safety-material", material)]),
    ).toMatchObject({
      ready: false,
      result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
      evidenceId: "safety-material",
      code: "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED",
    });
  });

  it("does not let a later READY acknowledge away a material scope change", () => {
    const material = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 2,
        issues: ["MATERIAL_SCOPE_EXPANSION_REQUIRED"],
        result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
        predecessor: { id: "safety-ready", evidenceHash: readyInitial.evidenceHash },
        createdAt: "2026-08-27T20:10:00.000Z",
      }),
    );
    const invalidRecovery = parseEmployeeRecordingSafetyEvidence(
      safetyFixture({
        sequence: 3,
        predecessor: { id: "safety-material", evidenceHash: material.evidenceHash },
        createdAt: "2026-08-27T20:15:00.000Z",
      }),
    );
    expect(
      readiness([
        stored("safety-ready", readyInitial),
        stored("safety-material", material),
        stored("safety-invalid-recovery", invalidRecovery),
      ]),
    ).toMatchObject({
      ready: false,
      result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
      evidenceId: "safety-material",
      code: "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED",
    });
  });

  it("fails closed when the V2 participant plan is unsupported", () => {
    const unsupported = parseRecordingAssessmentV2({
      contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash: LOCATION_HASH },
      intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
      expectedPeople: ["MINOR"],
      recordingFormat: "VIDEO_ONLY",
      recordingArea: { boundary: "SERVICE_AREA_ONLY" },
    });
    expect(
      readiness([], {
        assessment: {
          ...currentAssessment,
          scopeJson: unsupported.scopeJson,
          scopeHash: unsupported.scopeHash,
        },
      }),
    ).toMatchObject({
      ready: false,
      code: "V2_RUNTIME_SAFETY_PLAN_CHANGE_REQUIRED",
    });
  });
});
