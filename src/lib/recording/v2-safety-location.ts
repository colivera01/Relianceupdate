import { createHash, randomUUID } from "node:crypto";

import {
  RECORDING_LOCATION_MAX_ACCURACY_METERS,
  RECORDING_LOCATION_RADIUS_METERS,
  type RecordingLocationProof,
  type RecordingLocationVerification,
} from "@/lib/job-recording-location";
import { stableJsonV2 } from "./assessment-v2";
import type { EmployeeRecordingSafetyStage } from "./employee-safety";

export const V2_STAGE_LOCATION_EVIDENCE_VERSION =
  "recording-location-attempt-v2-stage-safety-v1" as const;
export const V2_STAGE_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

type V2StageLocationIdentity = {
  bookingId: string;
  vendorId: string;
  assessmentId: string;
  assessmentGeneration: number;
  membershipId: string;
  assignmentGeneration: number;
  stage: EmployeeRecordingSafetyStage;
  snapshotEvidenceHash: string;
};

export class V2SafetyLocationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "V2SafetyLocationError";
  }
}

function fail(code: string, message: string): never {
  throw new V2SafetyLocationError(code, message);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

function canonicalTimestamp(value: Date | string, label: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail("V2_LOCATION_TIMESTAMP_INVALID", `${label} is invalid.`);
  return parsed.toISOString();
}

export function buildV2StageLocationEvidence(input: V2StageLocationIdentity & {
  attemptId: string;
  status: string;
  resultCode: string;
  method: string;
  distanceMeters: number | null;
  accuracyMeters: number;
  latitude: number;
  longitude: number;
  capturedAt: Date | string;
  attemptedAt: Date | string;
}) {
  const evidence = {
    contractVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
    attemptId: input.attemptId,
    workRecord: { bookingId: input.bookingId, vendorId: input.vendorId },
    assessment: { id: input.assessmentId, generation: input.assessmentGeneration },
    employee: { membershipId: input.membershipId, assignmentGeneration: input.assignmentGeneration },
    stage: input.stage,
    target: { snapshotEvidenceHash: input.snapshotEvidenceHash },
    proof: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      capturedAt: canonicalTimestamp(input.capturedAt, "capturedAt"),
    },
    verification: {
      status: input.status,
      resultCode: input.resultCode,
      method: input.method,
      distanceMeters: input.distanceMeters,
      attemptedAt: canonicalTimestamp(input.attemptedAt, "attemptedAt"),
    },
  };
  const canonicalJson = stableJsonV2(evidence);
  return { evidence, canonicalJson, evidenceHash: sha256(canonicalJson) };
}

export async function persistV2StageLocationAttempt(input: V2StageLocationIdentity & {
  actorUserId: string | null;
  proof: RecordingLocationProof;
  result: RecordingLocationVerification;
  now?: Date;
  tx?: any;
}) {
  const latitude = Number(input.proof.latitude);
  const longitude = Number(input.proof.longitude);
  const accuracyMeters = Number(input.proof.accuracyMeters);
  if (!validCoordinate(latitude, longitude) || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    fail("V2_LOCATION_PROOF_INVALID", "Finite non-zero device coordinates and accuracy are required.");
  }
  const capturedAt = new Date(String(input.proof.capturedAt || ""));
  if (!Number.isFinite(capturedAt.getTime())) {
    fail("V2_LOCATION_CAPTURE_TIME_INVALID", "A canonical device capture time is required.");
  }
  const attemptedAt = input.now || new Date();
  const attemptId = randomUUID();
  const distanceMeters = input.result.ok
    ? Math.round(input.result.distanceMeters)
    : input.result.details?.distanceMeters ?? null;
  const canonical = buildV2StageLocationEvidence({
    ...input,
    attemptId,
    latitude,
    longitude,
    accuracyMeters: Math.round(accuracyMeters),
    capturedAt,
    attemptedAt,
    distanceMeters,
    status: input.result.ok ? "VERIFIED" : "FAILED",
    resultCode: input.result.ok ? "LOCATION_VERIFIED" : input.result.code,
    method: "DEVICE_GEOLOCATION",
  });
  const db = input.tx || (await import("@/server/db")).prisma;
  return (db as any).recordingLocationAttempt.create({
    data: {
      id: attemptId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      assessmentId: input.assessmentId,
      assessmentGeneration: input.assessmentGeneration,
      assignmentGeneration: input.assignmentGeneration,
      stage: input.stage,
      snapshotEvidenceHash: input.snapshotEvidenceHash,
      status: input.result.ok ? "VERIFIED" : "FAILED",
      resultCode: input.result.ok ? "LOCATION_VERIFIED" : input.result.code,
      method: "DEVICE_GEOLOCATION",
      distanceMeters,
      accuracyMeters: Math.round(accuracyMeters),
      latitude,
      longitude,
      capturedAt,
      actorUserId: input.actorUserId,
      attemptedAt,
      evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
      canonicalJson: canonical.canonicalJson,
      evidenceHash: canonical.evidenceHash,
    },
  });
}

export async function validateV2SafetyLocationAttempt(input: V2StageLocationIdentity & {
  locationAttemptId: string;
  now?: Date;
  tx: any;
}) {
  const row = await input.tx.recordingLocationAttempt.findFirst({
    where: { id: input.locationAttemptId },
  });
  if (!row) fail("V2_LOCATION_ATTEMPT_NOT_FOUND", "The stage location attempt was not found.");
  if (
    row.bookingId !== input.bookingId ||
    row.vendorId !== input.vendorId ||
    row.assessmentId !== input.assessmentId ||
    Number(row.assessmentGeneration) !== input.assessmentGeneration ||
    row.membershipId !== input.membershipId ||
    Number(row.assignmentGeneration) !== input.assignmentGeneration ||
    row.stage !== input.stage ||
    row.snapshotEvidenceHash !== input.snapshotEvidenceHash
  ) {
    fail("V2_LOCATION_BINDING_MISMATCH", "The stage location attempt belongs to different evidence.");
  }
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const accuracyMeters = Number(row.accuracyMeters);
  const distanceMeters = Number(row.distanceMeters);
  if (
    row.status !== "VERIFIED" ||
    row.resultCode !== "LOCATION_VERIFIED" ||
    !validCoordinate(latitude, longitude) ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    accuracyMeters > RECORDING_LOCATION_MAX_ACCURACY_METERS ||
    !Number.isFinite(distanceMeters) ||
    Math.max(0, distanceMeters - accuracyMeters) > RECORDING_LOCATION_RADIUS_METERS
  ) {
    fail("V2_LOCATION_NOT_VERIFIED", "The stage location attempt is not authoritative and verified.");
  }
  const capturedAt = new Date(row.capturedAt);
  const attemptedAt = new Date(row.attemptedAt);
  const now = input.now || new Date();
  if (
    !Number.isFinite(capturedAt.getTime()) ||
    !Number.isFinite(attemptedAt.getTime()) ||
    capturedAt.getTime() > attemptedAt.getTime() + 30_000 ||
    now.getTime() - capturedAt.getTime() > V2_STAGE_LOCATION_MAX_AGE_MS ||
    capturedAt.getTime() - now.getTime() > 30_000
  ) {
    fail("V2_LOCATION_ATTEMPT_STALE", "A fresh stage location attempt is required.");
  }
  if (row.evidenceVersion !== V2_STAGE_LOCATION_EVIDENCE_VERSION) {
    fail("V2_LOCATION_EVIDENCE_VERSION_INVALID", "The stage location evidence version is invalid.");
  }
  const canonical = buildV2StageLocationEvidence({
    ...input,
    attemptId: row.id,
    status: row.status,
    resultCode: row.resultCode,
    method: row.method,
    distanceMeters: row.distanceMeters,
    accuracyMeters: row.accuracyMeters,
    latitude: row.latitude,
    longitude: row.longitude,
    capturedAt: row.capturedAt,
    attemptedAt: row.attemptedAt,
  });
  if (canonical.canonicalJson !== row.canonicalJson || canonical.evidenceHash !== row.evidenceHash) {
    fail("V2_LOCATION_EVIDENCE_INVALID", "The stage location evidence integrity check failed.");
  }
  return { row, evidenceHash: canonical.evidenceHash };
}
