import { createHash } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

const stages = ["INTRO", "IN_PROGRESS", "COMPLETED"].map((stage, index) => ({
  stage,
  stageEvidenceId: `stage-${index + 1}`,
  stageVersion: 1,
  mediaAssetId: `asset-${index + 1}`,
  contentHash: `hash-${index + 1}`,
}));

function stageEvidenceRows() {
  return stages.map((row, index) => ({
    id: row.stageEvidenceId,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    stage: row.stage,
    stageVersion: row.stageVersion,
    isCurrent: true,
    mediaAssetId: row.mediaAssetId,
    contentHash: row.contentHash,
    uploadState: "SAVED",
    assessmentId: "assessment-1",
    assessmentGeneration: 2,
    permissionEvidenceId: "permission-1",
    recordingGateDecisionId: `gate-${index + 1}`,
    mediaSessionId: `session-${index + 1}`,
  }));
}

function mediaRows() {
  return stages.map((row) => ({
    id: row.mediaAssetId,
    contentHash: row.contentHash,
    stageVersion: row.stageVersion,
    uploadState: "SAVED",
    moderationStatus: "pending_review",
    visibilityStatus: "private",
    deletedAt: null,
  }));
}

function packageRow(status = "AWAITING_MANAGER_REVIEW") {
  return {
    id: "package-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    version: 3,
    isCurrent: true,
    status,
    stageEvidenceJson: JSON.stringify(stages),
    packageHash: "package-hash-1",
    managerDecisionId: status === "AWAITING_MANAGER_REVIEW" ? null : "manager-decision-1",
    adminAuditDecisionId: null,
    customerAccessGrantId: null,
  };
}

function managerSubmissionTx() {
  const pkg = packageRow();
  const tx: any = {
    booking: {
      findFirst: vi.fn().mockResolvedValue({
        id: "booking-1",
        status: "AWAITING_REVIEW",
        customerMetadata: "{}",
      }),
      update: vi.fn().mockResolvedValue({ id: "booking-1", status: "COMPLETED" }),
    },
    serviceVideoPackageEvidence: {
      findFirst: vi.fn().mockResolvedValue(pkg),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ ...pkg, ...data, status: "AWAITING_ADMIN_REVIEW" }),
      ),
    },
    serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stageEvidenceRows()) },
    mediaAsset: { findMany: vi.fn().mockResolvedValue(mediaRows()) },
    recordingGateDecisionEvidence: {
      findMany: vi.fn().mockResolvedValue(
        stages.map((_, index) => ({
          id: `gate-${index + 1}`,
          scopeHash: "scope-hash-1",
          assessmentGeneration: 2,
          permissionEvidenceId: "permission-1",
        })),
      ),
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
    privateProofAccessGrant: { create: vi.fn() },
  };
  return tx;
}

function adminDecisionTx(decision: "PASS" | "REJECT") {
  const pkg = packageRow("AWAITING_ADMIN_REVIEW");
  const attestationJson = JSON.stringify({ packageId: pkg.id, packageHash: pkg.packageHash });
  const managerDecision = {
    id: "manager-decision-1",
    packageId: pkg.id,
    bookingId: pkg.bookingId,
    vendorId: pkg.vendorId,
    packageVersion: pkg.version,
    packageHash: pkg.packageHash,
    decision: "SUBMITTED_FOR_ADMIN_AUDIT",
    attestationJson,
    attestationHash: createHash("sha256").update(attestationJson).digest("hex"),
  };
  const booking = {
    id: "booking-1",
    vendorId: "vendor-1",
    userId: "customer-1",
    status: "COMPLETED",
    title: "Outlet Installation",
    clientName: "Beta Customer",
    date: new Date("2026-08-24T12:00:00Z"),
    customerMetadata: JSON.stringify({
      reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" },
    }),
    rejectionReason: null,
    user: { name: "Beta Customer", email: "customer@example.test", phone: null },
    service: { name: "Outlet Installation" },
    vendor: { name: "Electro LLC", businessName: "Electro LLC" },
  };
  const audit = {
    id: "admin-audit-1",
    packageId: pkg.id,
    decision,
    customerProofReleased: false,
    decidedAt: new Date("2026-08-24T13:00:00Z"),
  };
  const tx: any = {
    serviceVideoPackageEvidence: {
      findFirst: vi.fn().mockResolvedValue(pkg),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        ...pkg,
        status: decision === "PASS" ? "PRIVATE_APPROVED" : "ADMIN_REJECTED",
        adminAuditDecisionId: audit.id,
      }),
    },
    booking: {
      findUnique: vi.fn().mockResolvedValue(booking),
      update: vi.fn().mockResolvedValue({}),
    },
    serviceVideoManagerDecisionEvidence: { findFirst: vi.fn().mockResolvedValue(managerDecision) },
    serviceVideoAdminAuditDecisionEvidence: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(audit),
      update: vi.fn().mockResolvedValue({}),
    },
    privateProofAccessGrant: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "grant-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stageEvidenceRows()) },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(mediaRows()),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    bookingNotification: {
      create: vi.fn().mockResolvedValue({ id: "customer-notification-1" }),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit-log-1" }) },
  };
  return { tx, pkg, booking, audit };
}

describe("core Service Video Admin Audit evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds manager submission to the exact package without releasing customer proof", async () => {
    const tx = managerSubmissionTx();
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { submitPackageForCoreAdminAudit } = await import("./service-video-admin-audit");

    const result = await submitPackageForCoreAdminAudit({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      managerUserId: "manager-1",
      managerMembershipId: "membership-1",
    });

    expect(result).toMatchObject({
      package: { status: "AWAITING_ADMIN_REVIEW" },
      managerDecision: {
        decision: "SUBMITTED_FOR_ADMIN_AUDIT",
        packageId: "package-1",
        packageVersion: 3,
        packageHash: "package-hash-1",
      },
      firstTransition: true,
    });
    expect(tx.serviceVideoManagerDecisionEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        packageId: "package-1",
        packageVersion: 3,
        packageHash: "package-hash-1",
        attestationJson: expect.stringContaining("stage-1"),
        attestationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(tx.privateProofAccessGrant.create).not.toHaveBeenCalled();
    expect(tx.bookingNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "SERVICE_VIDEO_ADMIN_AUDIT_READY_V1" }),
    });
  });

  it("reuses the exact manager attestation and notification on submission retry", async () => {
    const tx = managerSubmissionTx();
    const pkg = {
      ...packageRow("AWAITING_ADMIN_REVIEW"),
      managerDecisionId: "manager-decision-1",
    };
    tx.serviceVideoPackageEvidence.findFirst.mockResolvedValue(pkg);
    tx.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({
      id: "manager-decision-1",
      packageId: pkg.id,
      decision: "SUBMITTED_FOR_ADMIN_AUDIT",
      packageHash: pkg.packageHash,
    });
    tx.bookingNotification.findFirst.mockResolvedValue({ id: "admin-notification-existing" });
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { submitPackageForCoreAdminAudit } = await import("./service-video-admin-audit");

    const result = await submitPackageForCoreAdminAudit({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      managerUserId: "manager-1",
      managerMembershipId: "membership-1",
    });

    expect(result).toMatchObject({
      firstTransition: false,
      adminNotificationId: "service-video-admin-audit-package-1",
      adminEmailNotificationId: "admin-notification-existing",
    });
    expect(tx.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceVideoManagerDecisionEvidence.create).not.toHaveBeenCalled();
    expect(tx.adminNotification.upsert).not.toHaveBeenCalled();
    expect(tx.bookingNotification.create).not.toHaveBeenCalled();
  });

  it("atomically releases exact customer-only proof only after Admin PASS", async () => {
    const { tx } = adminDecisionTx("PASS");
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { decideCoreServiceVideoAdminAudit } = await import("./service-video-admin-audit");

    const result = await decideCoreServiceVideoAdminAudit({
      bookingId: "booking-1",
      adminUserId: "admin-1",
      adminRole: "ADMIN",
      decision: "PASS",
    });

    expect(result).toMatchObject({ alreadyDecided: false, grant: { id: "grant-1" } });
    expect(tx.privateProofAccessGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        packageId: "package-1",
        adminAuditDecisionId: "admin-audit-1",
        status: "ACTIVE",
      }),
    });
    expect(tx.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset-1", "asset-2", "asset-3"] }, deletedAt: null },
      data: expect.objectContaining({
        moderationStatus: "approved",
        visibilityStatus: "customer_only",
      }),
    });
    expect(tx.bookingNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "PRIVATE_PROOF_READY_ADMIN_AUDIT_V1" }),
    });
  });

  it("records terminal Admin REJECT without a customer grant or rejected-media release", async () => {
    const { tx } = adminDecisionTx("REJECT");
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { decideCoreServiceVideoAdminAudit } = await import("./service-video-admin-audit");

    const result = await decideCoreServiceVideoAdminAudit({
      bookingId: "booking-1",
      adminUserId: "admin-1",
      adminRole: "ADMIN",
      decision: "REJECT",
      rejectionCategory: "UNVERIFIABLE",
      reason: "The evidence cannot be verified.",
    });

    expect(result).toMatchObject({ alreadyDecided: false, grant: null });
    expect(tx.privateProofAccessGrant.create).not.toHaveBeenCalled();
    expect(tx.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset-1", "asset-2", "asset-3"] }, deletedAt: null },
      data: expect.objectContaining({
        moderationStatus: "rejected",
        visibilityStatus: "private",
      }),
    });
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectionReason: "UNVERIFIABLE: The evidence cannot be verified.",
      }),
    });
    expect(tx.bookingNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "PRIVATE_PROOF_AUDIT_REJECTED_V1" }),
    });
  });

  it("returns the same terminal decision idempotently without another durable mutation", async () => {
    const { tx, pkg, booking } = adminDecisionTx("PASS");
    tx.serviceVideoAdminAuditDecisionEvidence.findUnique.mockResolvedValue({
      id: "admin-audit-existing",
      packageId: pkg.id,
      decision: "PASS",
      customerNotificationId: "customer-notification-existing",
    });
    tx.booking.findUnique.mockResolvedValue(booking);
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { decideCoreServiceVideoAdminAudit } = await import("./service-video-admin-audit");

    const result = await decideCoreServiceVideoAdminAudit({
      bookingId: "booking-1",
      adminUserId: "admin-1",
      adminRole: "ADMIN",
      decision: "PASS",
    });

    expect(result).toMatchObject({
      alreadyDecided: true,
      decision: { id: "admin-audit-existing" },
      customerNotificationId: "customer-notification-existing",
    });
    expect(tx.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
    expect(tx.privateProofAccessGrant.create).not.toHaveBeenCalled();
    expect(tx.mediaAsset.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingNotification.create).not.toHaveBeenCalled();
  });

  it("rejects a competing terminal decision after one decision wins", async () => {
    const { tx, pkg } = adminDecisionTx("PASS");
    tx.serviceVideoAdminAuditDecisionEvidence.findUnique.mockResolvedValue({
      id: "admin-audit-existing",
      packageId: pkg.id,
      decision: "REJECT",
    });
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));
    const { decideCoreServiceVideoAdminAudit } = await import("./service-video-admin-audit");

    await expect(decideCoreServiceVideoAdminAudit({
      bookingId: "booking-1",
      adminUserId: "admin-1",
      adminRole: "ADMIN",
      decision: "PASS",
    })).rejects.toMatchObject({ code: "ADMIN_AUDIT_TERMINAL_DECISION_CONFLICT" });

    expect(tx.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["AWAITING_ADMIN_REVIEW", "ADMIN_AUDIT_IN_PROGRESS"],
    ["ADMIN_REJECTED", "ADMIN_AUDIT_REJECTED_TERMINAL"],
  ])("makes vendor mutations read-only for %s", async (status, code) => {
    const db: any = {
      serviceVideoPackageEvidence: {
        findFirst: vi.fn().mockResolvedValue({
          id: "package-1",
          status,
          adminAuditDecisionId: status === "ADMIN_REJECTED" ? "admin-audit-1" : null,
        }),
      },
      serviceVideoAdminAuditDecisionEvidence: { findFirst: vi.fn() },
    };
    const { assertCoreAdminAuditMutationAllowed } = await import("./service-video-admin-audit");

    await expect(assertCoreAdminAuditMutationAllowed(db, {
      bookingId: "booking-1",
      vendorId: "vendor-1",
    })).rejects.toMatchObject({ code });
  });
});
