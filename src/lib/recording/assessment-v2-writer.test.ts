import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  RecordingAssessmentV2WriterError,
  V2_ASSESSMENT_WRITER_RUNTIME_STATE,
  writeRecordingAssessmentV2,
} from "./assessment-v2-writer";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "./assessment-v2";

function locationMetadata(assignmentGeneration = 1) {
  const snapshot = {
    type: "business",
    source: "vendor_profile",
    status: "verified_coordinates",
    address: "2555 S Kirkman Rd",
    city: "Orlando",
    state: "FL",
    zip_code: "32811",
    latitude: 28.51,
    longitude: -81.46,
    geocoded_at: "2026-09-17T10:00:00.000Z",
    captured_at: "2026-09-17T10:00:00.000Z",
  } as Record<string, unknown>;
  const snapshotEvidenceHash = createHash("sha256")
    .update(JSON.stringify({
      type: snapshot.type,
      source: snapshot.source,
      address: snapshot.address,
      city: snapshot.city,
      state: snapshot.state,
      zipCode: snapshot.zip_code,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      providerEvidence: null,
    }))
    .digest("hex");
  snapshot.snapshot_evidence_hash = snapshotEvidenceHash;
  return {
    snapshotEvidenceHash,
    value: JSON.stringify({
      vendor_job_assignment_generation: assignmentGeneration,
      vendor_job_assigned_membership_ids: ["employee-1"],
      vendor_job_recording_location: "business",
      vendor_job_recording_location_snapshot: snapshot,
      vendor_job_service_order_released_at: "2026-09-17T10:10:00.000Z",
      vendor_job_service_order_released_membership_ids: ["employee-1"],
      vendor_job_consent_accepted: true,
    }),
  };
}

function proposal(snapshotEvidenceHash: string, overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
    ...overrides,
  };
}

function harness() {
  const metadata = locationMetadata();
  const booking = { id: "booking-1", vendorId: "vendor-1", customerMetadata: metadata.value };
  const assessments: any[] = [];
  const consentRecords = [{ id: "consent-old", bookingId: booking.id, isCurrent: true }];
  let transactionTail = Promise.resolve();
  let nextId = 1;
  const db: any = {
    $transaction: (callback: any) => {
      const result = transactionTail.then(() => callback(db));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
    booking: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === booking.id && where.vendorId === booking.vendorId ? booking : null),
      update: vi.fn(async ({ data }: any) => {
        booking.customerMetadata = data.customerMetadata;
        return booking;
      }),
    },
    vendorMembership: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === "manager-membership" && where.userId === "manager-1"
          ? { id: "manager-membership" }
          : null),
    },
    recordingScopeAssessment: {
      findFirst: vi.fn(async ({ where, select }: any) => {
        const rows = assessments
          .filter((row) =>
            row.bookingId === where.bookingId &&
            row.vendorId === where.vendorId &&
            (where.isCurrent === undefined || row.isCurrent === where.isCurrent))
          .sort((left, right) => right.generation - left.generation);
        const row = rows[0] || null;
        return row && select ? { generation: row.generation } : row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = assessments.find((item) => item.id === where.id && item.isCurrent);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `assessment-${nextId++}`, ...data };
        assessments.push(row);
        return row;
      }),
    },
    recordingAuthorityRequirement: { createMany: vi.fn(async () => ({ count: 2 })) },
    employeeRecordingCertification: { updateMany: vi.fn(async () => ({ count: 1 })) },
    employeeRecordingParticipationDecision: { updateMany: vi.fn(async () => ({ count: 1 })) },
    consentRecord: {
      findMany: vi.fn(async () => consentRecords.filter((row) => row.isCurrent)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        for (const row of consentRecords) {
          if (where.id.in.includes(row.id)) Object.assign(row, data);
        }
        return { count: 1 };
      }),
    },
    consentRequestLink: { updateMany: vi.fn(async () => ({ count: 1 })) },
    consentEvent: { create: vi.fn(async ({ data }: any) => data) },
    bookingNotification: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  const write = (options: Record<string, unknown> = {}) => writeRecordingAssessmentV2({
    db,
    bookingId: booking.id,
    vendorId: booking.vendorId,
    actorUserId: "manager-1",
    actorMembershipId: "manager-membership",
    expectedAssignmentGeneration: 1,
    expectedCurrent: null,
    proposal: proposal(metadata.snapshotEvidenceHash),
    now: new Date("2026-09-17T12:00:00.000Z"),
    ...options,
  });
  return { db, booking, assessments, consentRecords, metadata, write };
}

describe("dormant V2 recording-assessment writer", () => {
  it("is explicitly server-only and dormant from ordinary routes", () => {
    expect(V2_ASSESSMENT_WRITER_RUNTIME_STATE).toBe("DORMANT_NO_ORDINARY_ROUTE");
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
      }
    };
    visit(join(process.cwd(), "src", "app"));
    expect(
      files.filter((file) =>
        readFileSync(file, "utf8").includes("@/lib/recording/assessment-v2-writer"),
      ),
    ).toEqual([]);
  });

  it("creates one canonical current V2 assessment and clears stale release metadata", async () => {
    const state = harness();
    const result = await state.write();
    expect(result).toMatchObject({ created: true, idempotent: false });
    expect(result.assessment).toMatchObject({
      generation: 1,
      contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
      locationType: "business",
      isCurrent: true,
    });
    const metadata = JSON.parse(state.booking.customerMetadata);
    expect(metadata).not.toHaveProperty("vendor_job_service_order_released_at");
    expect(metadata).not.toHaveProperty("vendor_job_consent_accepted");
    expect(metadata.recording_assessment_scope_hash).toBe(result.assessment.scopeHash);
  });

  it("returns the same assessment for repeated and concurrent identical scope", async () => {
    const state = harness();
    const [first, second] = await Promise.all([state.write(), state.write()]);
    expect(state.assessments).toHaveLength(1);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.assessment.id).toBe(second.assessment.id);
  });

  it("creates the next generation for a material scope change and preserves history", async () => {
    const state = harness();
    const first = await state.write();
    const changed = proposal(state.metadata.snapshotEvidenceHash, {
      recordingFormat: "VIDEO_AUDIO",
    });
    const second = await state.write({
      expectedCurrent: {
        assessmentId: first.assessment.id,
        generation: first.assessment.generation,
        scopeHash: first.assessment.scopeHash,
      },
      proposal: changed,
    });
    expect(second.assessment.generation).toBe(2);
    expect(state.assessments).toHaveLength(2);
    expect(state.assessments[0]).toMatchObject({ isCurrent: false, status: "SUPERSEDED" });
    expect(state.db.employeeRecordingCertification.updateMany).toHaveBeenCalledTimes(2);
    expect(state.db.employeeRecordingParticipationDecision.updateMany).toHaveBeenCalledTimes(2);
    expect(state.consentRecords[0].isCurrent).toBe(false);
  });

  it("fails closed for stale writer, assignment, actor, and location contexts", async () => {
    const state = harness();
    const first = await state.write();
    await expect(state.write({
      expectedCurrent: null,
      proposal: proposal(state.metadata.snapshotEvidenceHash, {
        expectedPeople: ["CUSTOMER"],
      }),
    })).rejects.toMatchObject({ code: "V2_ASSESSMENT_WRITER_STALE" });
    await expect(state.write({ expectedAssignmentGeneration: 2 }))
      .rejects.toMatchObject({ code: "V2_ASSESSMENT_ASSIGNMENT_STALE" });
    await expect(state.write({ actorMembershipId: "employee-1" }))
      .rejects.toMatchObject({ code: "V2_ASSESSMENT_WRITER_FORBIDDEN" });
    await expect(state.write({
      expectedCurrent: {
        assessmentId: first.assessment.id,
        generation: first.assessment.generation,
        scopeHash: first.assessment.scopeHash,
      },
      proposal: proposal("f".repeat(64), { expectedPeople: ["CUSTOMER"] }),
    })).rejects.toMatchObject({ code: "V2_ASSESSMENT_LOCATION_STALE" });
  });

  it("does not bind Customer scope to an Employee identity during same-role reassignment", async () => {
    const state = harness();
    const first = await state.write();
    const metadata = JSON.parse(state.booking.customerMetadata);
    metadata.vendor_job_assignment_generation = 2;
    metadata.vendor_job_assigned_membership_ids = ["employee-2"];
    state.booking.customerMetadata = JSON.stringify(metadata);
    const repeated = await state.write({ expectedAssignmentGeneration: 2 });
    expect(repeated).toMatchObject({ created: false, idempotent: true });
    expect(repeated.assessment.id).toBe(first.assessment.id);
    expect(state.assessments).toHaveLength(1);
  });

  it("uses typed fail-closed writer errors", async () => {
    const state = harness();
    try {
      await state.write({ expectedAssignmentGeneration: 0 });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(RecordingAssessmentV2WriterError);
    }
  });
});
