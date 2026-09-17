import { describe, expect, it, vi } from "vitest";

import { hashOpaqueSecret } from "@/lib/consent/token";
import { deriveRecordingScopeAssessment } from "@/lib/recording/scope-assessment";
import {
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
} from "./employee-decision-verification";
import {
  decideEmployeeRecordingParticipation,
  resolveEmployeeRecordingParticipation,
} from "./employee-recording-participation";

function createHarness() {
  const derived = deriveRecordingScopeAssessment(
    {
      recordingLocation: "business",
      intentionalParticipantPlan: "assigned_service_professional",
      audioRequested: false,
    },
    {
      locationSnapshotEvidenceHash: "a".repeat(64),
      generation: 1,
      completedByUserId: "manager-1",
      completedAt: new Date("2026-09-17T10:00:00.000Z"),
    },
  );
  const assessment: any = {
    id: "assessment-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    generation: 1,
    isCurrent: true,
    status: "COMPLETE",
    contractVersion: derived.contractVersion,
    scopeHash: derived.scopeHash,
    scopeJson: derived.scopeJson,
    subjectJson: derived.subjectJson,
    propertyScope: "not_applicable",
    peopleScope: "not_applicable",
    frameControl: "not_applicable",
    audioRequested: false,
    audioAllowed: false,
  };
  const booking: any = {
    id: "booking-1",
    vendorId: "vendor-1",
    title: "Outlet Installation",
    service: { name: "Outlet Installation" },
    customerMetadata: JSON.stringify({
      vendor_job_assigned_membership_ids: ["membership-1", "membership-2"],
      vendor_job_assigned_employees: ["Employee One", "Employee Two"],
      vendor_job_assignment_generation: 3,
      vendor_job_employee_recording_participation_contract_version:
        "employee-recording-participation-v1",
    }),
  };
  const memberships: any[] = [
    {
      id: "membership-1",
      userId: "employee-1",
      vendorId: "vendor-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      membershipGeneration: 1,
      user: { name: "Employee One", email: "one@example.com", phone: null },
      vendor: { name: "Vendor One", businessName: "Vendor One" },
    },
    {
      id: "membership-2",
      userId: "employee-2",
      vendorId: "vendor-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      membershipGeneration: 1,
      user: { name: "Employee Two", email: "two@example.com", phone: null },
      vendor: { name: "Vendor One", businessName: "Vendor One" },
    },
  ];
  const decisions: any[] = [];
  const sessions = new Map<string, any>();
  let activeAssetCount = 0;
  let currentStageCount = 0;
  let privateProofReleased = false;
  let activePublicEligibility = false;

  const db: any = {
    $transaction: (callback: any) => callback(db),
    vendorMembership: {
      findUnique: vi.fn(async ({ where }: any) =>
        memberships.find((row) => row.id === where.id) || null),
      findMany: vi.fn(async ({ where }: any) =>
        memberships.filter((row) => where.id.in.includes(row.id))),
    },
    booking: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === booking.id && where.vendorId === booking.vendorId ? booking : null),
    },
    recordingScopeAssessment: {
      findFirst: vi.fn(async () => assessment),
    },
    employeeVerifiedDecisionSession: {
      findUnique: vi.fn(async ({ where }: any) => sessions.get(where.secretHash) || null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const session = Array.from(sessions.values()).find((row) => row.id === where.id);
        if (!session || session.consumedAt) return { count: 0 };
        Object.assign(session, data);
        return { count: 1 };
      }),
    },
    employeeRecordingParticipationDecision: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const rows = decisions
          .filter((row) =>
            (!where.bookingId || row.bookingId === where.bookingId) &&
            (!where.membershipId || row.membershipId === where.membershipId) &&
            (where.isCurrent === undefined || row.isCurrent === where.isCurrent),
          )
          .sort((left, right) => Number(right.version) - Number(left.version));
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        decisions
          .filter((row) =>
            row.bookingId === where.bookingId &&
            where.membershipId.in.includes(row.membershipId) &&
            row.isCurrent === where.isCurrent,
          )
          .sort((left, right) => Number(right.version) - Number(left.version))),
      update: vi.fn(async ({ where, data }: any) => {
        const row = decisions.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { createdAt: new Date(), invalidatedAt: null, supersededAt: null, ...data };
        decisions.push(row);
        return row;
      }),
    },
    serviceVideoStageEvidence: {
      count: vi.fn(async () => currentStageCount),
      findMany: vi.fn(async () => currentStageCount
        ? [{ id: "stage-1", mediaAssetId: "asset-1" }]
        : []),
      updateMany: vi.fn(async () => {
        currentStageCount = 0;
        return { count: 1 };
      }),
    },
    mediaSession: {
      findMany: vi.fn(async () => activeAssetCount ? [{ id: "media-session-1" }] : []),
    },
    mediaAsset: {
      count: vi.fn(async () => activeAssetCount),
      findMany: vi.fn(async () => activeAssetCount ? [{ id: "asset-1" }] : []),
      updateMany: vi.fn(async () => {
        activeAssetCount = 0;
        return { count: 1 };
      }),
    },
    mediaUploadAttempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
    privateProofAccessGrant: {
      findFirst: vi.fn(async () => privateProofReleased ? { id: "grant-1" } : null),
    },
    serviceVideoPackageEvidence: { updateMany: vi.fn(async () => ({ count: 1 })) },
    publicServiceVideoEligibility: {
      findMany: vi.fn(async () => activePublicEligibility
        ? [{ id: "eligibility-1", proposalId: "proposal-1", mediaAssetId: "asset-1" }]
        : []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    serviceVideoPublicationProposal: {
      findMany: vi.fn(async () => activePublicEligibility
        ? [{ packageVisibilityDecisionId: "visibility-1" }]
        : []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    serviceVideoPackageVisibilityDecision: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    bookingNotification: { upsert: vi.fn(async ({ create }: any) => create) },
  };

  async function addSession(membershipId: string, secret: string) {
    const membership = memberships.find((row) => row.id === membershipId)!;
    const employeeContext = await loadEmployeeDecisionContext({
      db,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      userId: membership.userId,
      membershipId,
      bookingId: booking.id,
    });
    sessions.set(hashOpaqueSecret(secret), {
      id: `session-${secret}`,
      userId: membership.userId,
      vendorId: membership.vendorId,
      membershipId,
      membershipGeneration: membership.membershipGeneration,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: employeeContext.contextHash,
      verifiedChannel: "email",
      verifiedContactHash: `contact-${membershipId}`,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      consumedAt: null,
    });
    return membership;
  }

  async function decide(
    membershipId: string,
    decision: "ALLOW" | "DECLINE",
    secret: string,
  ) {
    const membership = await addSession(membershipId, secret);
    return decideEmployeeRecordingParticipation({
      db,
      userId: membership.userId,
      membershipId,
      bookingId: booking.id,
      decision,
      sessionSecret: secret,
      now: new Date("2026-09-17T12:00:00.000Z"),
    });
  }

  return {
    db,
    booking,
    assessment,
    memberships,
    decisions,
    decide,
    setActiveMedia(count: number) { activeAssetCount = count; },
    setCurrentStages(count: number) { currentStageCount = count; },
    setPrivateProofReleased(value: boolean) { privateProofReleased = value; },
    setActivePublicEligibility(value: boolean) { activePublicEligibility = value; },
  };
}

describe("Employee Work Record recording participation", () => {
  it("requires every active Employee assigned in the current generation", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-1");
    const partial = await resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: harness.booking.customerMetadata,
      assessment: harness.assessment,
    });
    expect(partial).toMatchObject({
      required: true,
      complete: false,
      status: "REQUIRED",
      missingMembershipIds: ["membership-2"],
    });

    await harness.decide("membership-2", "ALLOW", "secret-2");
    const complete = await resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: harness.booking.customerMetadata,
      assessment: harness.assessment,
    });
    expect(complete).toMatchObject({
      complete: true,
      status: "ALLOWED",
      requiredMembershipIds: ["membership-1", "membership-2"],
    });
    expect(complete.evidence).toHaveLength(2);
  });

  it("fails closed when any assigned Employee declines", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-1");
    await harness.decide("membership-2", "DECLINE", "secret-2");
    await expect(resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: harness.booking.customerMetadata,
      assessment: harness.assessment,
    })).resolves.toMatchObject({
      complete: false,
      status: "DECLINED",
      declinedMembershipIds: ["membership-2"],
    });
    expect(harness.db.bookingNotification.upsert).toHaveBeenCalledTimes(1);
  });

  it("preserves DECLINE then ALLOW as append-only versions before capture", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "DECLINE", "secret-decline");
    await harness.decide("membership-1", "ALLOW", "secret-allow");
    expect(harness.decisions).toHaveLength(2);
    expect(harness.decisions.map((row) => [row.version, row.decision, row.isCurrent])).toEqual([
      [1, "DECLINE", false],
      [2, "ALLOW", true],
    ]);
  });

  it("rejects ALLOW while affected captured media is still active", async () => {
    const harness = createHarness();
    harness.setActiveMedia(1);
    await expect(harness.decide("membership-1", "ALLOW", "secret-allow"))
      .rejects.toThrow("EMPLOYEE_RECORDING_ALLOW_REQUIRES_RETAKE_BOUNDARY");
    expect(harness.decisions).toHaveLength(0);
  });

  it("archives affected pre-approval media on withdrawal and permits only future retake", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-first-allow");
    harness.setActiveMedia(1);
    harness.setCurrentStages(1);
    const withdrawal = await harness.decide("membership-1", "DECLINE", "secret-decline");
    expect(withdrawal).toMatchObject({ capturedMediaAffected: true, privateProofReleased: false });
    expect(harness.db.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ archiveStatus: "employee_participation_withdrawn" }),
    }));
    expect(harness.db.mediaUploadAttempt.updateMany).toHaveBeenCalled();

    await expect(harness.decide("membership-1", "ALLOW", "secret-second-allow"))
      .resolves.toMatchObject({ decision: { decision: "ALLOW", version: 3 } });
    expect(harness.decisions.filter((row) => row.isCurrent)).toHaveLength(1);
  });

  it("preserves Private Proof while restricting Public state after withdrawal", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-first-allow");
    harness.setActiveMedia(1);
    harness.setPrivateProofReleased(true);
    harness.setActivePublicEligibility(true);

    const withdrawal = await harness.decide("membership-1", "DECLINE", "secret-decline");

    expect(withdrawal).toMatchObject({
      capturedMediaAffected: true,
      privateProofReleased: true,
    });
    expect(harness.db.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ visibilityStatus: "customer_only", publicEligible: false }),
    }));
    expect(harness.db.serviceVideoPackageVisibilityDecision.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["visibility-1"] }, isCurrent: true },
      data: { isCurrent: false, supersededAt: expect.any(Date) },
    });
    expect(harness.db.serviceVideoStageEvidence.updateMany).not.toHaveBeenCalled();
  });

  it("invalidates prior evidence when assessment or membership generation changes", async () => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-1");
    await harness.decide("membership-2", "ALLOW", "secret-2");
    harness.memberships[0].membershipGeneration = 2;
    const changed = deriveRecordingScopeAssessment(
      {
        recordingLocation: "business",
        intentionalParticipantPlan: "assigned_service_professional",
        audioRequested: true,
      },
      {
        locationSnapshotEvidenceHash: "a".repeat(64),
        generation: 2,
        completedByUserId: "manager-1",
        completedAt: new Date("2026-09-17T13:00:00.000Z"),
      },
    );
    Object.assign(harness.assessment, {
      generation: 2,
      scopeHash: changed.scopeHash,
      scopeJson: changed.scopeJson,
      subjectJson: changed.subjectJson,
      audioRequested: true,
      audioAllowed: true,
    });
    const result = await resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: harness.booking.customerMetadata,
      assessment: harness.assessment,
    });
    expect(result.complete).toBe(false);
    expect(result.status).toBe("STALE");
    expect(result.staleMembershipIds).toEqual(["membership-1", "membership-2"]);
  });

  it.each([
    ["assignment generation changes", (harness: ReturnType<typeof createHarness>) => {
      const metadata = JSON.parse(harness.booking.customerMetadata);
      metadata.vendor_job_assignment_generation = 4;
      harness.booking.customerMetadata = JSON.stringify(metadata);
    }],
    ["assessment generation changes", (harness: ReturnType<typeof createHarness>) => {
      harness.assessment.generation = 2;
    }],
    ["scope hash changes", (harness: ReturnType<typeof createHarness>) => {
      const changed = deriveRecordingScopeAssessment(
        {
          recordingLocation: "residence",
          intentionalParticipantPlan: "assigned_service_professional",
          audioRequested: false,
        },
        {
          locationSnapshotEvidenceHash: "b".repeat(64),
          generation: 2,
          completedByUserId: "manager-1",
          completedAt: new Date("2026-09-17T13:00:00.000Z"),
        },
      );
      Object.assign(harness.assessment, {
        scopeHash: changed.scopeHash,
        scopeJson: changed.scopeJson,
        subjectJson: changed.subjectJson,
      });
    }],
    ["audio state changes", (harness: ReturnType<typeof createHarness>) => {
      harness.assessment.audioAllowed = true;
    }],
  ])("requires a fresh Employee decision when %s", async (_label, mutate) => {
    const harness = createHarness();
    await harness.decide("membership-1", "ALLOW", "secret-1");
    await harness.decide("membership-2", "ALLOW", "secret-2");
    mutate(harness);

    const result = await resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: harness.booking.customerMetadata,
      assessment: harness.assessment,
    });

    expect(result).toMatchObject({ complete: false, status: "STALE" });
    expect(result.staleMembershipIds).toEqual(["membership-1", "membership-2"]);
  });

  it("does not impose Phase 2 participation on historical contracts", async () => {
    const harness = createHarness();
    await expect(resolveEmployeeRecordingParticipation({
      db: harness.db,
      bookingId: harness.booking.id,
      vendorId: harness.booking.vendorId,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
      }),
      assessment: harness.assessment,
    })).resolves.toMatchObject({
      required: false,
      complete: true,
      status: "NOT_REQUIRED",
    });
  });
});
