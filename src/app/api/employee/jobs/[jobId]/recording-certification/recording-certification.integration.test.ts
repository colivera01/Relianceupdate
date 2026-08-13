import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentFindUnique: vi.fn(),
  consentFindFirst: vi.fn(),
  certificationFindFirst: vi.fn(),
  certificationUpdateMany: vi.fn(),
  certificationCreate: vi.fn(),
  authorityUpdateMany: vi.fn(),
  locationAttemptFindFirst: vi.fn(),
  locationExceptionFindFirst: vi.fn(),
  metricCreate: vi.fn(),
  packageFindFirst: vi.fn(),
  managerDecisionFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const prisma: any = {
    booking: { findUnique: db.bookingFindUnique },
    vendorMembership: { findMany: db.membershipFindMany },
    recordingScopeAssessment: {
      findFirst: db.assessmentFindFirst,
      findUnique: db.assessmentFindUnique,
    },
    consentRecord: { findFirst: db.consentFindFirst },
    employeeRecordingCertification: {
      findFirst: db.certificationFindFirst,
      updateMany: db.certificationUpdateMany,
      create: db.certificationCreate,
    },
    recordingLocationAttempt: { findFirst: db.locationAttemptFindFirst },
    recordingLocationException: { findFirst: db.locationExceptionFindFirst },
    recordingGateMetric: { create: db.metricCreate },
    serviceVideoPackageEvidence: { findFirst: db.packageFindFirst },
    serviceVideoManagerDecisionEvidence: { findFirst: db.managerDecisionFindFirst },
    recordingAuthorityRequirement: { updateMany: db.authorityUpdateMany },
  };
  prisma.$transaction = db.transaction;
  return { prisma };
});

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn(async () => "employee-1") }));
vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: vi.fn(async () => null),
}));
vi.mock("@/lib/lifecycle-audit", () => ({ recordLifecycleAudit: vi.fn(async () => undefined) }));

const metadata = JSON.stringify({
  vendor_job_assigned_membership_ids: ["membership-1"],
  vendor_job_service_order_released_membership_ids: ["membership-1"],
  vendor_job_service_order_released_at: "2026-08-04T12:00:00.000Z",
  vendor_job_assignment_generation: 2,
  vendor_job_recording_location: "business",
  vendor_job_recording_location_snapshot: {
    type: "business",
    source: "vendor_profile",
    status: "verified_coordinates",
    address: "123 Main St",
    city: "Orlando",
    state: "FL",
    zip_code: "32801",
    latitude: 28.5383,
    longitude: -81.3792,
    captured_at: "2026-08-04T11:00:00.000Z",
  },
});

const assessment = {
  id: "assessment-1",
  vendorId: "vendor-1",
  status: "COMPLETE",
  locationType: "business",
  riskLevel: "LEVEL_1",
  propertyScope: "vendor_owned",
  peopleScope: "none",
  frameControl: "controlled",
  subjectJson: "{}",
  scopeJson: "{}",
  scopeHash: "scope-hash-1",
  permissionRequired: false,
  serviceCanContinueWithoutRecording: true,
  audioRequested: false,
  audioAllowed: false,
  authorities: [],
};

describe("employee recording certification", () => {
  let activeCertification: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    activeCertification = null;
    db.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      customerMetadata: metadata,
    });
    db.membershipFindMany.mockResolvedValue([
      { id: "membership-1", vendorId: "vendor-1", userId: "employee-1" },
    ]);
    db.assessmentFindFirst.mockResolvedValue(assessment);
    db.assessmentFindUnique.mockResolvedValue({
      id: assessment.id,
      scopeHash: assessment.scopeHash,
      scopeJson: assessment.scopeJson,
    });
    db.consentFindFirst.mockResolvedValue(null);
    db.certificationFindFirst.mockImplementation(async () => activeCertification);
    db.certificationUpdateMany.mockResolvedValue({ count: 0 });
    db.certificationCreate.mockImplementation(async ({ data }: any) => {
      activeCertification = {
        id: "certification-1",
        certifiedAt: new Date("2026-08-04T13:00:00.000Z"),
        ...data,
      };
      return activeCertification;
    });
    db.authorityUpdateMany.mockResolvedValue({ count: 1 });
    db.locationAttemptFindFirst.mockResolvedValue({ status: "VERIFIED", resultCode: "LOCATION_VERIFIED" });
    db.locationExceptionFindFirst.mockResolvedValue(null);
    db.metricCreate.mockResolvedValue({ id: "metric-1" });
    db.packageFindFirst.mockResolvedValue(null);
    db.managerDecisionFindFirst.mockResolvedValue(null);
    db.transaction.mockImplementation(async (callback: (tx: any) => unknown) =>
      callback({
        employeeRecordingCertification: {
          updateMany: db.certificationUpdateMany,
          create: db.certificationCreate,
        },
        recordingAuthorityRequirement: { updateMany: db.authorityUpdateMany },
      }),
    );
  });

  it("requires an affirmative employee certification", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/recording-certification", {
        method: "POST",
        body: JSON.stringify({ accepted: false }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(422);
    expect(db.certificationCreate).not.toHaveBeenCalled();
  });

  it("stores certification for the current assignment and scope before unlocking", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/recording-certification", {
        method: "POST",
        body: JSON.stringify({ accepted: true }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(db.certificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "job-1",
        membershipId: "membership-1",
        assessmentId: "assessment-1",
        assignmentGeneration: 2,
        scopeHash: "scope-hash-1",
      }),
    });
    expect(db.authorityUpdateMany).toHaveBeenCalledWith({
      where: {
        assessmentId: "assessment-1",
        authorityType: "EMPLOYEE_LIKENESS",
        status: { not: "VERIFIED" },
      },
      data: expect.objectContaining({
        status: "VERIFIED",
        actorUserId: "employee-1",
        evidenceReference: "certification-1",
      }),
    });
    expect(json.recordingGate).toMatchObject({
      certificationActive: true,
      recordingUnlocked: true,
      block: null,
    });
  });
});
