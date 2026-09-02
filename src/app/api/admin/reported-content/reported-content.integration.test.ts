import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx: any = { contentReport: { update: vi.fn() }, contentReportCaseEvent: { create: vi.fn() } };
  const prisma: any = {
    contentReport: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    contentReportCaseEvent: { findMany: vi.fn() },
    mediaLifecycleRestriction: { findFirst: vi.fn() },
    mediaAsset: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    mediaEvidenceHold: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(tx)),
  };
  return { prisma, tx, openCase: vi.fn(), createHold: vi.fn(), releaseCase: vi.fn(), releaseHold: vi.fn(), restore: vi.fn(), sendResolution: vi.fn() };
});

vi.mock("@/server/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/media-lifecycle", () => ({ openMediaLifecycleCase: h.openCase, createEvidenceHold: h.createHold, releaseContentReportPublicHold: h.releaseCase, releaseEvidenceHold: h.releaseHold }));
vi.mock("@/lib/service-video-publication", () => ({ restoreImmediatePublicVisibilityAfterHold: h.restore }));
vi.mock("@/lib/notifications/send-content-report-resolution", () => ({ sendContentReportResolution: h.sendResolution }));

import { requireAdmin } from "@/lib/admin-auth";
import { GET, PATCH } from "./route";

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1", caseReference: "RP-A1B2C3D4", targetType: "media_asset", targetId: "asset-1",
    bookingId: "booking-1", vendorId: "vendor-1", reportedUserId: "customer-1", reportedVendorId: "vendor-1",
    reporterUserId: "reporter-1", reporterVendorId: null, reporterRole: "customer",
    reasonCategory: "private_sensitive_information", reasonDetail: "Sensitive address", status: "open", severity: "high",
    autoHidden: false, packageId: "package-1", packageVersion: 2, packageHash: "package-hash",
    stage: "INTRO", stageVersion: 1, stageHash: "stage-hash", mediaContentHash: "media-hash",
    adminAuditDecisionId: "audit-1", visibilityAtReport: "PUBLIC", policyCategory: "PRIVACY",
    createdAt: new Date("2026-09-02T12:00:00Z"), updatedAt: new Date("2026-09-02T12:00:00Z"), resolvedAt: null,
    ...overrides,
  };
}

describe("admin reported-content cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    h.prisma.contentReport.count.mockResolvedValue(1);
    h.prisma.contentReport.findMany.mockResolvedValue([report()]);
    h.prisma.contentReport.findUnique.mockResolvedValue(report());
    h.prisma.contentReportCaseEvent.findMany.mockResolvedValue([{ id: "event-1", eventType: "REPORT_CREATED", actorRole: "customer", createdAt: new Date() }]);
    h.prisma.mediaLifecycleRestriction.findFirst.mockResolvedValue(null);
    h.prisma.mediaAsset.findUnique.mockResolvedValue({ visibilityStatus: "public", deletedAt: null });
    h.prisma.booking.findUnique.mockResolvedValue({ title: "Breaker Replacement", clientName: "Customer", user: { name: "Customer" }, vendor: { businessName: "Electro LLC" }, service: { name: "Breaker Replacement" } });
    h.tx.contentReport.update.mockImplementation(async ({ data }: any) => report({ ...data, updatedAt: new Date() }));
    h.tx.contentReportCaseEvent.create.mockResolvedValue({ id: "event-2" });
  });

  it("lists exact evidence, current visibility, and append-only events", async () => {
    const response = await GET(new Request("http://localhost/api/admin/reported-content?q=RP-A1B2C3D4"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reports[0]).toMatchObject({ caseReference: "RP-A1B2C3D4", packageHash: "package-hash", stage: "INTRO", currentVisibility: "PUBLIC", publicHoldActive: false, vendorName: "Electro LLC", events: [{ eventType: "REPORT_CREATED" }] });
  });

  it("requires notes before a terminal resolution", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "resolve_action_taken" }) }));
    expect(response.status).toBe(422);
    expect(h.tx.contentReport.update).not.toHaveBeenCalled();
  });

  it("appends a triage event without creating a Trust Score input", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "mark_triaged" }) }));
    expect(response.status).toBe(200);
    expect(h.tx.contentReport.update).toHaveBeenCalledWith({ where: { id: "report-1" }, data: expect.objectContaining({ status: "triaged", adminOwnerUserId: "admin-1" }) });
    expect(h.tx.contentReportCaseEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "MARK_TRIAGED", priorStatus: "open", resultingStatus: "triaged" }) });
  });

  it("lets Admin apply a package-level Public hold explicitly", async () => {
    h.openCase.mockResolvedValue({ id: "lifecycle-1" });
    h.prisma.mediaLifecycleRestriction.findFirst.mockResolvedValue({ id: "restriction-1" });
    h.prisma.contentReport.update.mockResolvedValue(report({ lifecycleCaseId: "lifecycle-1" }));
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "apply_public_hold", resolutionNotes: "Investigating privacy concern" }) }));
    expect(response.status).toBe(200);
    expect(h.openCase).toHaveBeenCalledWith(expect.objectContaining({ contentReportId: "report-1", packageId: "package-1", category: "PRIVACY", forcePublicRestriction: true }));
  });

  it("revalidates canonical publication evidence when Admin releases a hold", async () => {
    h.prisma.contentReport.findUnique.mockResolvedValue(report({ lifecycleCaseId: "lifecycle-1", autoHidden: true }));
    h.prisma.mediaEvidenceHold.findFirst.mockResolvedValue(null);
    h.releaseCase.mockResolvedValue({ id: "lifecycle-1", status: "RESOLVED" });
    h.restore.mockResolvedValue({ restored: true });
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "release_public_hold", resolutionNotes: "No violation found" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ report: { publicHoldActive: false, publicVisibilityRestored: true } });
    expect(h.releaseCase).toHaveBeenCalledWith(expect.objectContaining({ lifecycleCaseId: "lifecycle-1" }));
    expect(h.restore).toHaveBeenCalledWith({ bookingId: "booking-1", actorUserId: "admin-1" });
  });

  it("does not duplicate terminal case history or notifications when a resolution is retried", async () => {
    h.prisma.contentReport.findUnique.mockResolvedValue(report({ status: "resolved_action_taken", resolvedAt: new Date(), resolutionNotes: "Validated", updatedAt: new Date() }));
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "resolve_action_taken" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, idempotent: true });
    expect(h.tx.contentReport.update).not.toHaveBeenCalled();
    expect(h.sendResolution).not.toHaveBeenCalled();
  });

  it("keeps a terminal resolution successful when reporter email delivery fails", async () => {
    h.prisma.user.findUnique.mockResolvedValue({ email: "reporter@example.test" });
    h.prisma.contentReport.update.mockResolvedValue(report());
    h.sendResolution.mockRejectedValue(new Error("provider unavailable"));
    const response = await PATCH(new Request("http://localhost/api/admin/reported-content", { method: "PATCH", body: JSON.stringify({ reportId: "report-1", action: "resolve_no_violation", resolutionNotes: "No violation found" }) }));
    expect(response.status).toBe(200);
    expect(h.tx.contentReport.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "resolved_no_action" }) }));
    expect(h.tx.contentReportCaseEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "REPORTER_RESOLUTION_NOTIFICATION_FAILED" }) });
  });
});
