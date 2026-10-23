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

import { submitPackageForCoreAdminAudit } from "./service-video-admin-audit";

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
});
