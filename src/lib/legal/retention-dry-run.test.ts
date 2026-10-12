import { describe, expect, it, vi } from "vitest";

import {
  loadRetentionWorkerDryRun,
  resolvePublicToPrivateRetentionDryRun,
} from "./retention-dry-run";

const now = new Date("2026-10-12T18:00:00.000Z");

describe("non-mutating retention dry-run", () => {
  it("does not invent a retention date when Public media becomes Private", () => {
    const result = resolvePublicToPrivateRetentionDryRun({
      schedule: {
        id: "schedule-1",
        mediaAssetId: "asset-1",
        materialClass: "PUBLIC_MEDIA",
        approvalActive: true,
        retainUntil: null,
        evidenceRetainUntil: null,
      },
      now,
    });
    expect(result).toMatchObject({
      dryRun: true,
      mutating: false,
      action: "WOULD_REQUIRE_SCHEDULE_RECALCULATION",
      existingRetainUntil: null,
      existingEvidenceRetainUntil: null,
    });
  });

  it("keeps active holds ahead of a due disposition", () => {
    const result = resolvePublicToPrivateRetentionDryRun({
      schedule: {
        id: "schedule-1", mediaAssetId: "asset-1", materialClass: "PRIVATE_MEDIA",
        approvalActive: false, retainUntil: new Date("2026-01-01T00:00:00.000Z"),
      },
      activeHold: { id: "hold-1", status: "ACTIVE" },
      now,
    });
    expect(result).toMatchObject({ action: "WOULD_RETAIN_UNDER_ACTIVE_HOLD", holdId: "hold-1" });
  });

  it("reports an existing disposition without creating another", () => {
    const result = resolvePublicToPrivateRetentionDryRun({
      schedule: {
        id: "schedule-1", mediaAssetId: "asset-1", materialClass: "PRIVATE_MEDIA",
        approvalActive: false, retainUntil: new Date("2026-01-01T00:00:00.000Z"),
      },
      activeDeletion: { id: "deletion-1", status: "QUEUED" },
      now,
    });
    expect(result).toMatchObject({ action: "EXISTING_DISPOSITION_IN_PROGRESS", deletionRequestId: "deletion-1" });
  });

  it("observes due schedules without any update, queue, or delete call", async () => {
    const write = vi.fn(() => { throw new Error("retention dry-run attempted a write"); });
    const db = {
      mediaRetentionSchedule: {
        findMany: vi.fn().mockResolvedValue([{
          id: "schedule-1", bookingId: "booking-1", mediaAssetId: "asset-1",
          materialClass: "PRIVATE_MEDIA", approvalActive: false,
          retainUntil: new Date("2026-01-01T00:00:00.000Z"), evidenceRetainUntil: null,
        }]),
        update: write,
        updateMany: write,
      },
      publicServiceVideoEligibility: { findFirst: vi.fn().mockResolvedValue(null), updateMany: write },
      mediaEvidenceHold: { findFirst: vi.fn().mockResolvedValue(null), create: write, update: write },
      mediaDeletionRequest: { findFirst: vi.fn().mockResolvedValue(null), create: write, update: write },
      mediaDeletionJob: { create: write, upsert: write, update: write },
      mediaAsset: { update: write, delete: write },
    };
    const result = await loadRetentionWorkerDryRun({ db, now, limit: 25 });
    expect(result).toMatchObject({
      dryRun: true,
      mutating: false,
      candidateCount: 1,
      counts: { WOULD_BE_DUE_FOR_DISPOSITION_REVIEW: 1 },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("observes active Public eligibility without changing the schedule", async () => {
    const write = vi.fn();
    const db = {
      mediaRetentionSchedule: {
        findMany: vi.fn().mockResolvedValue([{
          id: "schedule-1", bookingId: "booking-1", mediaAssetId: "asset-1",
          materialClass: "PRIVATE_MEDIA", approvalActive: false,
          retainUntil: new Date("2026-01-01T00:00:00.000Z"), evidenceRetainUntil: null,
        }]),
        update: write,
      },
      publicServiceVideoEligibility: { findFirst: vi.fn().mockResolvedValue({ id: "public-1" }) },
      mediaEvidenceHold: { findFirst: vi.fn().mockResolvedValue(null) },
      mediaDeletionRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const result = await loadRetentionWorkerDryRun({ db, now });
    expect(result.items[0]).toMatchObject({ action: "WOULD_KEEP_PUBLIC_APPROVAL_ACTIVE", publicEligibilityId: "public-1" });
    expect(write).not.toHaveBeenCalled();
  });
});
