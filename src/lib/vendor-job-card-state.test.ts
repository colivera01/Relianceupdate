import { describe, expect, it } from "vitest";

import {
  canExposeVendorJobArchiveAction,
  getVendorJobWorkflowBucket,
  hasCanonicalPrivateProof,
  isTerminalAdminAuditJob,
  preserveVendorDashboardCanonicalEvidence,
} from "./vendor-job-card-state";

const passedJob = {
  id: "job-pass",
  status: "completed",
  operationalPhase: "COMPLETED",
  serviceVideoPackage: { id: "package-pass", status: "PRIVATE_APPROVED", version: 1 },
  adminAuditDecision: { decision: "PASS", packageVersion: 1 },
  videos: [],
};

const rejectedJob = {
  id: "job-reject",
  status: "rejected",
  operationalPhase: "REJECTED",
  serviceVideoPackage: { id: "package-reject", status: "ADMIN_REJECTED", version: 1 },
  adminAuditDecision: { decision: "REJECT", packageVersion: 1 },
  videos: [],
};

describe("vendor Manage Jobs card state", () => {
  it("preserves canonical package and Admin audit evidence from the dashboard payload", () => {
    expect(preserveVendorDashboardCanonicalEvidence(passedJob)).toMatchObject({
      serviceVideoPackage: passedJob.serviceVideoPackage,
      adminAuditDecision: passedJob.adminAuditDecision,
    });
  });

  it("classifies only canonical Admin-approved evidence as Private Proof", () => {
    expect(hasCanonicalPrivateProof(passedJob)).toBe(true);
    expect(getVendorJobWorkflowBucket(passedJob)).toBe("private_complete");

    expect(
      getVendorJobWorkflowBucket({
        id: "generic-complete",
        status: "completed",
        operationalPhase: "COMPLETED",
        videos: [],
      }),
    ).toBe("active");
    expect(
      getVendorJobWorkflowBucket({
        ...passedJob,
        adminAuditDecision: null,
      }),
    ).toBe("active");
  });

  it("keeps only an actionable package in the Reliance Audit bucket", () => {
    expect(
      getVendorJobWorkflowBucket({
        status: "completed",
        operationalPhase: "AWAITING_ADMIN_REVIEW",
        serviceVideoPackage: { status: "AWAITING_ADMIN_REVIEW" },
        adminAuditDecision: null,
      }),
    ).toBe("moderator_review");
    expect(getVendorJobWorkflowBucket(passedJob)).not.toBe("moderator_review");
    expect(getVendorJobWorkflowBucket(rejectedJob)).not.toBe("moderator_review");
  });

  it("treats PASS and REJECT as terminal and hides Archive Job", () => {
    expect(isTerminalAdminAuditJob(passedJob)).toBe(true);
    expect(isTerminalAdminAuditJob(rejectedJob)).toBe(true);
    expect(canExposeVendorJobArchiveAction(passedJob)).toBe(false);
    expect(canExposeVendorJobArchiveAction(rejectedJob)).toBe(false);
    expect(canExposeVendorJobArchiveAction({ status: "completed" })).toBe(true);
  });
});
