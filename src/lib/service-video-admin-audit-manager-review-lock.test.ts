import { createHash } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  assertRecordingAuthorizationCurrent: vi.fn(),
  assertServiceVideoAudioEvidenceConforms: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/service-video-evidence", () => ({
  REQUIRED_SERVICE_VIDEO_STAGES: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  assertRecordingAuthorizationCurrent: mocks.assertRecordingAuthorizationCurrent,
  assertServiceVideoAudioEvidenceConforms: mocks.assertServiceVideoAudioEvidenceConforms,
}));
vi.mock("@/lib/employee-recording-participation", () => ({
  employeeRecordingParticipationContractEnabled: () => true,
}));

import {
  loadCoreAdminAuditCandidate,
  submitPackageForCoreAdminAudit,
} from "./service-video-admin-audit";

const packageStages = ["INTRO", "IN_PROGRESS", "COMPLETED"].map((stage, index) => ({
  stage,
  stageEvidenceId: `stage-${index + 1}`,
  stageVersion: 1,
  mediaAssetId: `asset-${index + 1}`,
  contentHash: `hash-${index + 1}`,
}));

function transactionDb() {
  const pkg = {
    id: "package-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    version: 4,
    isCurrent: true,
    status: "AWAITING_MANAGER_REVIEW",
    stageEvidenceJson: JSON.stringify(packageStages),
    packageHash: "package-hash-1",
    managerDecisionId: null,
  };
  const stages = packageStages.map((stage, index) => ({
    id: stage.stageEvidenceId,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    stage: stage.stage,
    stageVersion: 1,
    isCurrent: true,
    mediaAssetId: stage.mediaAssetId,
    contentHash: stage.contentHash,
    uploadState: "SAVED",
    assessmentId: "assessment-1",
    assessmentGeneration: 2,
    permissionEvidenceId: "permission-1",
    recordingGateDecisionId: `gate-${index + 1}`,
    mediaSessionId: `session-${index + 1}`,
    employeeMembershipId: "employee-membership-1",
    audioExpected: false,
    audioPresence: "ABSENT",
    audioTrackCount: 0,
    audioEvidenceVersion: 2,
  }));
  const db: any = {
    booking: {
      findFirst: vi.fn().mockResolvedValue({
        id: "booking-1",
        status: "AWAITING_REVIEW",
        customerMetadata: JSON.stringify({
          vendor_job_employee_recording_participation_contract_version:
            "employee-recording-participation-v1",
        }),
      }),
      update: vi.fn().mockResolvedValue({ id: "booking-1", status: "COMPLETED" }),
    },
    serviceVideoPackageEvidence: {
      findFirst: vi.fn().mockResolvedValue(pkg),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...pkg, ...data })),
    },
    serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stages) },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(stages.map((stage) => ({
        id: stage.mediaAssetId,
        vendorId: stage.vendorId,
        mediaSessionId: stage.mediaSessionId,
        uploadedByMembershipId: stage.employeeMembershipId,
        contentHash: stage.contentHash,
        stageVersion: stage.stageVersion,
        uploadState: "SAVED",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "ACTIVE",
        mimeType: "video/mp4",
        bytes: 1024,
        blobUrl: `https://example.blob.core.windows.net/private/${stage.mediaAssetId}`,
        deletedAt: null,
        audioExpected: false,
        audioPresence: "ABSENT",
        audioTrackCount: 0,
        audioEvidenceVersion: 2,
      }))),
    },
    recordingGateDecisionEvidence: {
      findMany: vi.fn().mockResolvedValue(stages.map((stage, index) => ({
        id: `gate-${index + 1}`,
        scopeHash: "scope-hash-1",
        assessmentGeneration: stage.assessmentGeneration,
        permissionEvidenceId: stage.permissionEvidenceId,
        audioExpected: false,
      }))),
    },
    serviceVideoManagerDecisionEvidence: {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: "manager-decision-1", ...data }),
      ),
    },
    adminNotification: { upsert: vi.fn().mockResolvedValue({}) },
    bookingNotification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "admin-notification-1" }),
    },
  };
  return db;
}

function adminCandidateDb() {
  const pkg = {
    id: "package-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    version: 4,
    isCurrent: true,
    status: "AWAITING_ADMIN_REVIEW",
    stageEvidenceJson: JSON.stringify(packageStages),
    packageHash: "package-hash-1",
    managerDecisionId: "manager-decision-1",
  };
  const stages = packageStages.map((stage, index) => ({
    id: stage.stageEvidenceId,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    stage: stage.stage,
    stageVersion: stage.stageVersion,
    isCurrent: true,
    mediaAssetId: stage.mediaAssetId,
    contentHash: stage.contentHash,
    uploadState: "SAVED",
    assessmentId: "assessment-1",
    assessmentGeneration: 2,
    permissionEvidenceId: "permission-1",
    recordingGateDecisionId: `gate-${index + 1}`,
    mediaSessionId: `session-${index + 1}`,
    employeeMembershipId: "employee-membership-1",
    audioExpected: false,
    audioPresence: "ABSENT",
    audioTrackCount: 0,
    audioEvidenceVersion: 2,
  }));
  const attestationJson = JSON.stringify({
    evidenceVersion: 1,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    packageId: pkg.id,
    packageVersion: pkg.version,
    packageHash: pkg.packageHash,
    managerUserId: "manager-1",
    managerMembershipId: "manager-membership-1",
    stages: stages.map((stage) => ({
      stage: stage.stage,
      stageEvidenceId: stage.id,
      stageVersion: stage.stageVersion,
      mediaAssetId: stage.mediaAssetId,
      contentHash: stage.contentHash,
      assessmentId: stage.assessmentId,
      assessmentGeneration: stage.assessmentGeneration,
      permissionEvidenceId: stage.permissionEvidenceId,
      recordingGateDecisionId: stage.recordingGateDecisionId,
      scopeHash: "scope-hash-1",
    })),
  });
  return {
    serviceVideoPackageEvidence: { findFirst: vi.fn().mockResolvedValue(pkg) },
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        id: "booking-1",
        vendorId: "vendor-1",
        userId: "customer-1",
        status: "COMPLETED",
        title: "Breaker Replacement",
        clientName: "Beta Customer",
        date: new Date("2026-11-03T12:00:00Z"),
        customerMetadata: JSON.stringify({
          vendor_job_employee_recording_participation_contract_version:
            "employee-recording-participation-v1",
          reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" },
        }),
        rejectionReason: null,
        user: { name: "Beta Customer", email: "customer@example.test", phone: null },
        service: { id: "service-1", name: "Breaker Replacement" },
        vendor: { name: "Electro LLC", businessName: "Electro LLC" },
      }),
    },
    serviceVideoManagerDecisionEvidence: {
      findFirst: vi.fn().mockResolvedValue({
        id: "manager-decision-1",
        packageId: pkg.id,
        bookingId: "booking-1",
        vendorId: "vendor-1",
        packageVersion: pkg.version,
        packageHash: pkg.packageHash,
        decision: "SUBMITTED_FOR_ADMIN_AUDIT",
        managerUserId: "manager-1",
        managerMembershipId: "manager-membership-1",
        evidenceVersion: 1,
        attestationJson,
        attestationHash: createHash("sha256").update(attestationJson).digest("hex"),
      }),
    },
    vendorMembership: {
      findFirst: vi.fn().mockResolvedValue({
        id: "manager-membership-1",
        user: { name: "Morgan Manager", email: "manager@example.test" },
      }),
    },
    serviceVideoAdminAuditDecisionEvidence: { findUnique: vi.fn().mockResolvedValue(null) },
    privateProofAccessGrant: { findFirst: vi.fn().mockResolvedValue(null) },
    serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stages) },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(stages.map((stage) => ({
        id: stage.mediaAssetId,
        vendorId: stage.vendorId,
        mediaSessionId: stage.mediaSessionId,
        uploadedByMembershipId: stage.employeeMembershipId,
        contentHash: stage.contentHash,
        stageVersion: stage.stageVersion,
        uploadState: "SAVED",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "ACTIVE",
        mimeType: "video/webm",
        bytes: 1024,
        blobUrl: `https://example.invalid/${stage.mediaAssetId}`,
        deletedAt: null,
        audioExpected: false,
        audioPresence: "ABSENT",
        audioTrackCount: 0,
        audioEvidenceVersion: 2,
      }))),
    },
  } as any;
}

describe("Manager review lock compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertRecordingAuthorizationCurrent.mockResolvedValue({ id: "gate" });
    mocks.assertServiceVideoAudioEvidenceConforms.mockReturnValue(undefined);
  });

  it("revalidates current Employee participation evidence without treating the expected review lock as stale", async () => {
    const db = transactionDb();
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(db));

    const result = await submitPackageForCoreAdminAudit({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      managerUserId: "manager-1",
      managerMembershipId: "manager-membership-1",
      expectedPackageId: "package-1",
      expectedPackageVersion: 4,
    });

    expect(result.firstTransition).toBe(true);
    expect(mocks.assertRecordingAuthorizationCurrent).toHaveBeenCalledTimes(3);
    expect(mocks.assertRecordingAuthorizationCurrent).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({
        stage: "INTRO",
        surface: "admin_evidence",
        actorKind: "VENDOR_MANAGER",
        acceptedPostCaptureBlockCode: "MANAGER_REVIEW_IN_PROGRESS",
      }),
    );
  });

  it("fails closed when the Manager confirms a different package version", async () => {
    const db = transactionDb();
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(db));

    await expect(submitPackageForCoreAdminAudit({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      managerUserId: "manager-1",
      managerMembershipId: "manager-membership-1",
      expectedPackageId: "package-1",
      expectedPackageVersion: 3,
    })).rejects.toMatchObject({ code: "ADMIN_AUDIT_PACKAGE_VERSION_MISMATCH" });
    expect(mocks.assertRecordingAuthorizationCurrent).not.toHaveBeenCalled();
    expect(db.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
  });

  it("revalidates an Admin candidate against the exact Admin-audit lock", async () => {
    const db = adminCandidateDb();

    await expect(loadCoreAdminAuditCandidate(db, "booking-1")).resolves.toMatchObject({
      package: { id: "package-1", status: "AWAITING_ADMIN_REVIEW" },
    });
    expect(mocks.assertRecordingAuthorizationCurrent).toHaveBeenCalledTimes(3);
    expect(mocks.assertRecordingAuthorizationCurrent).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({
        stage: "INTRO",
        surface: "admin_evidence",
        actorKind: "RELIANCE_ADMIN",
        acceptedPostCaptureBlockCode: "ADMIN_AUDIT_IN_PROGRESS",
      }),
    );
  });
});
