import { describe, expect, it, vi } from "vitest";

import {
  buildV2StageLocationEvidence,
  persistV2StageLocationAttempt,
  validateV2SafetyLocationAttempt,
  V2_STAGE_LOCATION_EVIDENCE_LEGACY_VERSION,
  V2_STAGE_LOCATION_EVIDENCE_VERSION,
  V2SafetyLocationError,
} from "./v2-safety-location";

const identity = {
  locationAttemptId: "attempt-starting-1",
  bookingId: "booking-1",
  vendorId: "vendor-1",
  assessmentId: "assessment-1",
  assessmentGeneration: 2,
  membershipId: "membership-1",
  assignmentGeneration: 4,
  stage: "STARTING_CONDITION" as const,
  snapshotEvidenceHash: "a".repeat(64),
};

function locationRow(overrides: Record<string, unknown> = {}) {
  const values = {
    id: identity.locationAttemptId,
    bookingId: identity.bookingId,
    vendorId: identity.vendorId,
    assessmentId: identity.assessmentId,
    assessmentGeneration: identity.assessmentGeneration,
    membershipId: identity.membershipId,
    assignmentGeneration: identity.assignmentGeneration,
    stage: identity.stage,
    snapshotEvidenceHash: identity.snapshotEvidenceHash,
    status: "VERIFIED",
    resultCode: "LOCATION_VERIFIED",
    method: "DEVICE_GEOLOCATION",
    distanceMeters: 12,
    accuracyMeters: 5,
    latitude: 28.51,
    longitude: -81.46,
    capturedAt: new Date("2026-08-27T19:59:00.000Z"),
    attemptedAt: new Date("2026-08-27T20:00:00.000Z"),
    ...overrides,
  };
  const canonical = buildV2StageLocationEvidence({
    attemptId: String(values.id),
    bookingId: String(values.bookingId),
    vendorId: String(values.vendorId),
    assessmentId: String(values.assessmentId),
    assessmentGeneration: Number(values.assessmentGeneration),
    membershipId: String(values.membershipId),
    assignmentGeneration: Number(values.assignmentGeneration),
    stage: values.stage as typeof identity.stage,
    snapshotEvidenceHash: String(values.snapshotEvidenceHash),
    status: String(values.status),
    resultCode: String(values.resultCode),
    method: String(values.method),
    distanceMeters: values.distanceMeters as number | null,
    accuracyMeters: Number(values.accuracyMeters),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    capturedAt: values.capturedAt as Date,
    attemptedAt: values.attemptedAt as Date,
  });
  return {
    ...values,
    evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
    canonicalJson: canonical.canonicalJson,
    evidenceHash: canonical.evidenceHash,
  };
}

async function validate(row: Record<string, any>, overrides: Record<string, unknown> = {}) {
  const tx = {
    recordingLocationAttempt: { findFirst: vi.fn().mockResolvedValue(row) },
  };
  return validateV2SafetyLocationAttempt({
    tx,
    ...identity,
    now: new Date("2026-08-27T20:00:30.000Z"),
    ...overrides,
  } as any);
}

async function expectCode(
  row: Record<string, any>,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  try {
    await validate(row, overrides);
    throw new Error("Expected V2 location validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(V2SafetyLocationError);
    expect((error as V2SafetyLocationError).code).toBe(code);
  }
}

describe("V2 stage-specific location evidence", () => {
  it("accepts exact fresh verified stage evidence", async () => {
    await expect(validate(locationRow())).resolves.toMatchObject({
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      row: { id: identity.locationAttemptId, stage: "STARTING_CONDITION" },
    });
  });

  it("normalizes coordinates before hashing and persistence", async () => {
    const create = vi.fn(async ({ data }: any) => data);
    const latitude = 28.123456789012345;
    const longitude = -81.98765432109876;
    const result = await persistV2StageLocationAttempt({
      bookingId: identity.bookingId,
      vendorId: identity.vendorId,
      assessmentId: identity.assessmentId,
      assessmentGeneration: identity.assessmentGeneration,
      membershipId: identity.membershipId,
      assignmentGeneration: identity.assignmentGeneration,
      stage: identity.stage,
      snapshotEvidenceHash: identity.snapshotEvidenceHash,
      actorUserId: "employee-1",
      proof: {
        latitude,
        longitude,
        accuracyMeters: 5,
        capturedAt: "2026-08-27T20:00:00.000Z",
      },
      result: { ok: true, location: "business", distanceMeters: 12 },
      now: new Date("2026-08-27T20:00:01.000Z"),
      tx: { recordingLocationAttempt: { create } },
    });

    expect(result.latitude).toBe(28.1234568);
    expect(result.longitude).toBe(-81.9876543);
    expect(JSON.parse(result.canonicalJson).proof).toMatchObject({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    expect(result.evidenceVersion).toBe(V2_STAGE_LOCATION_EVIDENCE_VERSION);
  });

  it("accepts current evidence after a sub-precision SQL coordinate round trip", async () => {
    const row = locationRow({ latitude: 28.123456789012345 });
    row.latitude += 3.552713678800501e-15;

    await expect(validate(row)).resolves.toMatchObject({
      row: { id: identity.locationAttemptId },
    });
  });

  it("preserves strict validation for historical v1 evidence", async () => {
    const row = locationRow({ latitude: 28.123456789012345 });
    const historical = buildV2StageLocationEvidence({
      attemptId: row.id,
      bookingId: row.bookingId,
      vendorId: row.vendorId,
      assessmentId: row.assessmentId,
      assessmentGeneration: row.assessmentGeneration,
      membershipId: row.membershipId,
      assignmentGeneration: row.assignmentGeneration,
      stage: row.stage,
      snapshotEvidenceHash: row.snapshotEvidenceHash,
      evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_LEGACY_VERSION,
      status: row.status,
      resultCode: row.resultCode,
      method: row.method,
      distanceMeters: row.distanceMeters,
      accuracyMeters: row.accuracyMeters,
      latitude: 28.123456789012345,
      longitude: row.longitude,
      capturedAt: row.capturedAt,
      attemptedAt: row.attemptedAt,
    });

    await expectCode(
      {
        ...row,
        evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_LEGACY_VERSION,
        canonicalJson: historical.canonicalJson,
        evidenceHash: historical.evidenceHash,
        latitude: 28.123456789012348,
      },
      "V2_LOCATION_EVIDENCE_INVALID",
    );
  });

  it.each([
    ["another booking", { bookingId: "booking-2" }],
    ["another employee", { membershipId: "membership-2" }],
    ["another assignment generation", { assignmentGeneration: 5 }],
    ["another assessment generation", { assessmentGeneration: 3 }],
    ["another stage", { stage: "WORK_IN_PROGRESS" }],
    ["another immutable snapshot", { snapshotEvidenceHash: "b".repeat(64) }],
  ])("rejects evidence from %s", async (_label, overrides) => {
    await expectCode(locationRow(overrides), "V2_LOCATION_BINDING_MISMATCH");
  });

  it("rejects stale evidence", async () => {
    await expectCode(
      locationRow({ capturedAt: new Date("2026-08-27T19:50:00.000Z") }),
      "V2_LOCATION_ATTEMPT_STALE",
    );
  });

  it.each([
    ["failed", { status: "FAILED" }],
    ["unverified result", { resultCode: "OUTSIDE_RADIUS" }],
    ["zero coordinates", { latitude: 0, longitude: 0 }],
    ["insufficient accuracy", { accuracyMeters: 501 }],
  ])("rejects %s evidence", async (_label, overrides) => {
    await expectCode(locationRow(overrides), "V2_LOCATION_NOT_VERIFIED");
  });

  it("rejects non-finite coordinates", async () => {
    await expectCode(
      { ...locationRow(), latitude: Number.NaN },
      "V2_LOCATION_NOT_VERIFIED",
    );
  });

  it("rejects tampered canonical evidence", async () => {
    await expectCode(
      { ...locationRow(), evidenceHash: "f".repeat(64) },
      "V2_LOCATION_EVIDENCE_INVALID",
    );
  });
});
