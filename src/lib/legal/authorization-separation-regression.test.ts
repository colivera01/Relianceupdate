import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { resolveEmployeeRecordingParticipation } from "@/lib/employee-recording-participation";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
} from "@/lib/recording/assessment-v2";
import { resolveV2CustomerRecordingAuthorization } from "@/lib/recording/v2-customer-recording-authorization";

function recordingFixture(role = "EMPLOYEE") {
  const derived = parseRecordingAssessmentV2({
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash: "a".repeat(64) },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
  });
  const assessment = {
    id: "assessment-1", bookingId: "booking-1", vendorId: "vendor-1", generation: 1,
    isCurrent: true, status: "COMPLETE", contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    scopeHash: derived.scopeHash, scopeJson: derived.scopeJson, subjectJson: derived.subjectJson,
    propertyScope: "not_applicable", peopleScope: "not_applicable", frameControl: "not_applicable",
    audioRequested: false, audioAllowed: false, permissionRequired: true,
  };
  const metadata = JSON.stringify({
    vendor_job_assigned_membership_ids: ["membership-1"],
    vendor_job_assigned_employees: ["Employee One"],
    vendor_job_assignment_generation: 1,
    vendor_job_employee_recording_participation_contract_version: "employee-recording-participation-v1",
  });
  const membership = {
    id: "membership-1", userId: "employee-1", vendorId: "vendor-1", role, status: "ACTIVE",
    membershipGeneration: 1,
    user: { name: "Employee One", email: "employee@example.test", phone: null },
    vendor: { name: "Vendor One", businessName: "Vendor One" },
  };
  const db = {
    vendorMembership: {
      findMany: vi.fn().mockResolvedValue([membership]),
      findUnique: vi.fn().mockResolvedValue(membership),
    },
    booking: {
      findFirst: vi.fn().mockResolvedValue({
        id: "booking-1", vendorId: "vendor-1", title: "Service", customerMetadata: metadata,
        service: { name: "Service" },
      }),
    },
    recordingScopeAssessment: { findFirst: vi.fn().mockResolvedValue(assessment) },
    employeeRecordingParticipationDecision: { findMany: vi.fn().mockResolvedValue([]) },
    employeePublicMediaConsentDecision: {
      findMany: vi.fn().mockResolvedValue([{ id: "standing-public-allow", decision: "ALLOW" }]),
    },
    serviceVideoPackageVisibilityDecision: {
      findMany: vi.fn().mockResolvedValue([{ id: "customer-public", decision: "SHARE_PUBLICLY" }]),
    },
  };
  return { assessment, metadata, db };
}

describe("authorization domains remain separate", () => {
  it("does not treat Employee standing Public or Customer package Public evidence as job-specific participation", async () => {
    const fixture = recordingFixture();
    const resolution = await resolveEmployeeRecordingParticipation({
      db: fixture.db,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: fixture.metadata,
      assessment: fixture.assessment,
    });
    expect(resolution).toMatchObject({
      required: true,
      complete: false,
      status: "REQUIRED",
      requiredMembershipIds: ["membership-1"],
      missingMembershipIds: ["membership-1"],
    });
    expect(fixture.db.employeePublicMediaConsentDecision.findMany).not.toHaveBeenCalled();
    expect(fixture.db.serviceVideoPackageVisibilityDecision.findMany).not.toHaveBeenCalled();
  });

  it("does not let a Manager membership stand in for the required Employee", async () => {
    const fixture = recordingFixture("MANAGER");
    const resolution = await resolveEmployeeRecordingParticipation({
      db: fixture.db,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: fixture.metadata,
      assessment: fixture.assessment,
    });
    expect(resolution).toMatchObject({
      required: true,
      complete: false,
      status: "STALE",
      requiredMembershipIds: [],
      inactiveMembershipIds: ["membership-1"],
    });
  });

  it("does not treat any Employee or Public evidence as Customer recording authorization", () => {
    const fixture = recordingFixture();
    const result = resolveV2CustomerRecordingAuthorization({
      assessment: {
        ...fixture.assessment,
        employeeParticipation: { status: "ALLOWED" },
        employeeStandingPublic: { status: "ALLOWED" },
        customerPackageVisibility: { decision: "SHARE_PUBLICLY" },
      },
      consentRecord: null,
    });
    expect(result).toMatchObject({
      required: true,
      allowed: false,
      status: "REQUIRED",
      code: "CUSTOMER_RECORDING_AUTH_REQUIRED",
    });
  });

  it("keeps four persisted authorization chains and their server writers distinct", () => {
    const root = process.cwd();
    const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    for (const model of [
      "ConsentDecisionEvidence",
      "EmployeeRecordingParticipationDecision",
      "EmployeePublicMediaConsentDecision",
      "ServiceVideoPackageVisibilityDecision",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
    const routeContracts = [
      ["src/app/api/consent/accept/route.ts", "completePermissionDecision"],
      ["src/app/api/employee/jobs/[jobId]/recording-participation/route.ts", "decideEmployeeRecordingParticipation"],
      ["src/app/api/employee/public-media-consent/route.ts", "decideEmployeePublicMediaConsent"],
      ["src/app/api/bookings/[id]/visibility/route.ts", "decidePackageVisibility"],
    ];
    for (const [file, writer] of routeContracts) {
      expect(fs.readFileSync(path.join(root, file), "utf8")).toContain(writer);
    }
    const employeeContext = fs.readFileSync(
      path.join(root, "src/lib/employee-decision-verification.ts"),
      "utf8",
    );
    expect(employeeContext).toContain('String(membership.role || "").toUpperCase() !== "EMPLOYEE"');
    expect(employeeContext).toContain('throw new Error("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN")');
  });
});
