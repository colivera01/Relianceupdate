import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/consent/recording-gate", () => ({
  loadCanonicalRecordingGate: loadGate,
}));

import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "./assessment-v2";
import { resolveCurrentV2RecordingAuthorization } from "./recording-authorization-v2";

function gate(overrides: Record<string, unknown> = {}) {
  return {
    assessmentContractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    assessmentId: "assessment-2",
    assessmentGeneration: 2,
    scopeHash: "scope-2",
    assignmentGeneration: 3,
    permissionRequired: true,
    permissionState: "accepted",
    consentRecordId: "consent-2",
    permissionDecisionEvidenceId: "customer-decision-2",
    recordingUnlocked: true,
    blockCode: null,
    employeeParticipation: {
      required: true,
      complete: true,
      status: "ALLOWED",
      requiredMembershipIds: ["employee-1"],
      missingMembershipIds: [],
      declinedMembershipIds: [],
      staleMembershipIds: [],
    },
    ...overrides,
  };
}

describe("canonical V2 recording authorization facade", () => {
  const db = {
    booking: {
      findFirst: vi.fn(async () => ({
        customerMetadata: JSON.stringify({
          vendor_job_service_order_released_membership_ids: ["employee-1"],
        }),
      })),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loadGate.mockResolvedValue(gate());
  });

  it("returns exact current assessment, assignment, Customer, Employee, and stage evidence", async () => {
    const result = await resolveCurrentV2RecordingAuthorization({
      db,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "employee-1",
      stage: "INTRO",
      surface: "media_session",
    });
    expect(result).toMatchObject({
      authorized: true,
      blockReasons: [],
      context: {
        assessmentId: "assessment-2",
        assessmentGeneration: 2,
        assignmentGeneration: 3,
        scopeHash: "scope-2",
        stage: "INTRO",
      },
      customer: {
        required: true,
        status: "accepted",
        decisionEvidenceId: "customer-decision-2",
      },
      employees: { complete: true, status: "ALLOWED" },
      serviceOrderCurrent: true,
    });
  });

  it("reports every-current-Employee participation as a separate blocking contract", async () => {
    loadGate.mockResolvedValue(gate({
      recordingUnlocked: false,
      blockCode: "EMPLOYEE_RECORDING_PARTICIPATION_REQUIRED",
      employeeParticipation: {
        required: true,
        complete: false,
        status: "REQUIRED",
        requiredMembershipIds: ["employee-1", "employee-2"],
        missingMembershipIds: ["employee-2"],
        declinedMembershipIds: [],
        staleMembershipIds: [],
      },
    }));
    const result = await resolveCurrentV2RecordingAuthorization({
      db,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "employee-1",
      stage: "IN_PROGRESS",
      surface: "employee_stage",
    });
    expect(result.authorized).toBe(false);
    expect(result.blockReasons).toEqual([
      "EMPLOYEE_RECORDING_PARTICIPATION_REQUIRED",
      "MULTIPLE_EMPLOYEE_PARTICIPATION_REQUIRED",
    ]);
    expect(result.employees.missingMembershipIds).toEqual(["employee-2"]);
  });

  it("fails closed when the current assessment is not V2", async () => {
    loadGate.mockResolvedValue(gate({
      assessmentContractVersion: "recording-assessment-v3-simplified-work-scope-v2",
    }));
    await expect(resolveCurrentV2RecordingAuthorization({
      db,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "employee-1",
      stage: "COMPLETED",
      surface: "upload_complete",
    })).rejects.toThrow("V2_RECORDING_ASSESSMENT_REQUIRED");
  });
});
