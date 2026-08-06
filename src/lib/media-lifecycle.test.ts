import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const prisma: any = {
    mediaLifecycleRestriction: { findMany: vi.fn(), create: vi.fn() },
    mediaDeletionRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mediaEvidenceHold: { findMany: vi.fn(), findFirst: vi.fn() },
    mediaLifecycleCase: { findFirst: vi.fn() },
    publicServiceVideoEligibility: { updateMany: vi.fn() },
    mediaWithdrawalEvidence: { findFirst: vi.fn(), create: vi.fn() },
    mediaLifecycleAuditEvent: { create: vi.fn() },
    mediaDeletionJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    mediaDeletionAttempt: { create: vi.fn(), update: vi.fn() },
    mediaAsset: { findUnique: vi.fn(), update: vi.fn() },
    mediaRetentionSchedule: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma, deleteBlob: vi.fn(), getBlobProperties: vi.fn() };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/azure-blob-storage", () => ({
  deleteBlob: hoisted.deleteBlob,
  getBlobProperties: hoisted.getBlobProperties,
}));

import {
  applyMediaWithdrawal,
  leastExposureOutcome,
  processDueRetentionSchedules,
  processMediaDeletionJobs,
  resolveCanonicalMediaLifecycle,
} from "./media-lifecycle";

describe("canonical media lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (value: any) =>
      typeof value === "function" ? value(hoisted.prisma) : Promise.all(value),
    );
    hoisted.prisma.mediaLifecycleRestriction.findMany.mockResolvedValue([]);
    hoisted.prisma.mediaDeletionRequest.findMany.mockResolvedValue([]);
    hoisted.prisma.mediaEvidenceHold.findMany.mockResolvedValue([]);
    hoisted.prisma.mediaLifecycleCase.findFirst.mockResolvedValue(null);
  });

  it("always chooses the least-exposure valid outcome", () => {
    expect(
      leastExposureOutcome(["PUBLIC", "PRIVATE", "HELD", "RESTRICTED"]),
    ).toBe("HELD");
    expect(leastExposureOutcome(["PUBLIC", "DELETED", "PRIVATE"])).toBe(
      "DELETED",
    );
  });

  it("restricts Public access without destroying valid Private proof", async () => {
    hoisted.prisma.mediaLifecycleRestriction.findMany.mockResolvedValue([
      {
        scope: "PUBLIC",
        outcome: "RESTRICTED",
        reasonCode: "PUBLICATION_WITHDRAWN",
      },
    ]);
    await expect(
      resolveCanonicalMediaLifecycle({
        bookingId: "booking-1",
        mediaAssetId: "asset-1",
        intendedAudience: "PUBLIC",
      }),
    ).resolves.toMatchObject({ outcome: "RESTRICTED", publicAllowed: false });
    await expect(
      resolveCanonicalMediaLifecycle({
        bookingId: "booking-1",
        mediaAssetId: "asset-1",
        intendedAudience: "PRIVATE",
      }),
    ).resolves.toMatchObject({ outcome: "PRIVATE", privateAllowed: true });
  });

  it("blocks recording when a recording withdrawal is active", async () => {
    hoisted.prisma.mediaLifecycleRestriction.findMany.mockResolvedValue([
      {
        scope: "RECORDING",
        outcome: "RESTRICTED",
        reasonCode: "RECORDING_WITHDRAWN",
      },
    ]);
    await expect(
      resolveCanonicalMediaLifecycle({
        bookingId: "booking-1",
        intendedAudience: "PRIVATE",
      }),
    ).resolves.toMatchObject({
      recordingAllowed: false,
      blockReason: "RECORDING_WITHDRAWN",
    });
  });

  it("invalidates Public eligibility before returning an applied publication withdrawal", async () => {
    hoisted.prisma.mediaWithdrawalEvidence.findFirst.mockResolvedValue(null);
    hoisted.prisma.mediaWithdrawalEvidence.create.mockResolvedValue({
      id: "withdrawal-1",
      status: "APPLIED",
    });
    hoisted.prisma.mediaLifecycleRestriction.create.mockResolvedValue({
      id: "restriction-1",
    });
    hoisted.prisma.publicServiceVideoEligibility.updateMany.mockResolvedValue({
      count: 1,
    });
    hoisted.prisma.mediaLifecycleAuditEvent.create.mockResolvedValue({
      id: "audit-1",
    });
    const result = await applyMediaWithdrawal({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "customer-1",
      actorRole: "CUSTOMER",
      authorityType: "CUSTOMER",
      scope: "PUBLICATION",
    });
    expect(result).toMatchObject({ status: "APPLIED" });
    expect(
      hoisted.prisma.publicServiceVideoEligibility.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INVALIDATED" }),
      }),
    );
  });
});

describe("retention disposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (value: any) =>
      typeof value === "function" ? value(hoisted.prisma) : Promise.all(value),
    );
    hoisted.prisma.mediaRetentionSchedule.findMany.mockResolvedValue([
      {
        id: "schedule-1",
        bookingId: "booking-1",
        vendorId: "vendor-1",
        mediaAssetId: "asset-1",
      },
    ]);
    hoisted.prisma.publicServiceVideoEligibility.findFirst = vi
      .fn()
      .mockResolvedValue(null);
    hoisted.prisma.mediaEvidenceHold.findFirst.mockResolvedValue(null);
    hoisted.prisma.mediaDeletionRequest.findFirst.mockResolvedValue(null);
    hoisted.prisma.mediaDeletionRequest.create.mockResolvedValue({
      id: "request-1",
      status: "QUEUED",
    });
    hoisted.prisma.mediaLifecycleRestriction.create.mockResolvedValue({
      id: "restriction-1",
    });
    hoisted.prisma.mediaDeletionJob.upsert = vi
      .fn()
      .mockResolvedValue({ id: "job-1", status: "QUEUED" });
    hoisted.prisma.mediaRetentionSchedule.update.mockResolvedValue({});
    hoisted.prisma.mediaLifecycleAuditEvent.create.mockResolvedValue({});
  });

  it("queues expired private media for deletion without reporting it deleted", async () => {
    await expect(processDueRetentionSchedules()).resolves.toEqual([
      { scheduleId: "schedule-1", status: "DELETION_QUEUED" },
    ]);
    expect(hoisted.prisma.mediaDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "QUEUED" }),
      }),
    );
    expect(hoisted.prisma.mediaRetentionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELETION_QUEUED" }),
      }),
    );
    expect(hoisted.prisma.mediaAsset.update).not.toHaveBeenCalled();
  });
});

describe("truthful physical deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (value: any) =>
      typeof value === "function" ? value(hoisted.prisma) : Promise.all(value),
    );
    hoisted.prisma.mediaEvidenceHold.findFirst.mockResolvedValue(null);
    hoisted.prisma.mediaDeletionJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        deletionRequestId: "request-1",
        bookingId: "booking-1",
        vendorId: "vendor-1",
        mediaAssetId: "asset-1",
        status: "QUEUED",
        attemptCount: 0,
        maxAttempts: 5,
        leaseExpiresAt: null,
      },
    ]);
    hoisted.prisma.mediaDeletionJob.updateMany.mockResolvedValue({ count: 1 });
    hoisted.prisma.mediaDeletionAttempt.create.mockResolvedValue({
      id: "attempt-1",
    });
    hoisted.prisma.mediaAsset.findUnique.mockResolvedValue({
      id: "asset-1",
      blobKey: "vendor/asset.webm",
    });
    hoisted.prisma.mediaDeletionAttempt.update.mockResolvedValue({});
    hoisted.prisma.mediaDeletionJob.update.mockResolvedValue({});
    hoisted.prisma.mediaDeletionRequest.update.mockResolvedValue({});
    hoisted.prisma.mediaAsset.update.mockResolvedValue({});
    hoisted.prisma.mediaLifecycleAuditEvent.create.mockResolvedValue({});
  });

  it("uses COMPLETED only after blob absence is verified", async () => {
    hoisted.deleteBlob.mockResolvedValue(true);
    hoisted.getBlobProperties.mockResolvedValue({ exists: false });
    await expect(processMediaDeletionJobs()).resolves.toEqual([
      { jobId: "job-1", status: "COMPLETED", verifiedAbsent: true },
    ]);
    expect(hoisted.prisma.mediaDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });

  it("returns RETRY_REQUIRED while the blob is still present", async () => {
    hoisted.deleteBlob.mockResolvedValue(true);
    hoisted.getBlobProperties.mockResolvedValue({ exists: true });
    await expect(processMediaDeletionJobs()).resolves.toEqual([
      { jobId: "job-1", status: "RETRY_REQUIRED", verifiedAbsent: false },
    ]);
    expect(hoisted.prisma.mediaDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RETRY_REQUIRED" }),
      }),
    );
    expect(hoisted.prisma.mediaAsset.update).not.toHaveBeenCalled();
  });
});
