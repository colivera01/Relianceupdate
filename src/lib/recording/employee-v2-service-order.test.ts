import { describe, expect, it } from "vitest";

import { hashOpaqueSecret } from "@/lib/consent/token";
import type { EmployeeDecisionContext } from "@/lib/employee-decision-verification";
import {
  EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION,
  EMPLOYEE_RECORDING_PARTICIPATION_TEXT,
  type EmployeeRecordingParticipationResolution,
} from "@/lib/employee-recording-participation";
import { parseRecordingAssessmentV2 } from "@/lib/recording/assessment-v2";
import {
  buildEmployeeV2ServiceOrderView,
  employeeRecordingParticipationPolicySnapshot,
  employeeV2NextState,
} from "@/lib/recording/employee-v2-service-order";

const canonical = parseRecordingAssessmentV2({
  contractVersion: "recording-assessment-v4-multiscope-safety-v1",
  location: {
    type: "CUSTOMER_RESIDENCE",
    snapshotEvidenceHash: "a".repeat(64),
  },
  intendedSubjects: [
    "EXISTING_CONDITION_OR_DAMAGE",
    "WORK_BEING_PERFORMED",
    "COMPLETED_WORK_OR_FINAL_CONDITION",
  ],
  expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL", "CUSTOMER"],
  recordingFormat: "VIDEO_AUDIO",
  recordingArea: { boundary: "SERVICE_AREA_ONLY" },
});

const assessment = {
  id: "assessment-v2",
  generation: 3,
  contractVersion: "recording-assessment-v4-multiscope-safety-v1",
  scopeJson: canonical.scopeJson,
  scopeHash: canonical.scopeHash,
};

const decisionContext: EmployeeDecisionContext = {
  purpose: "EMPLOYEE_RECORDING_PARTICIPATION",
  userId: "employee-1",
  vendorId: "vendor-1",
  membershipId: "membership-1",
  membershipGeneration: 1,
  bookingId: "booking-1",
  assignmentGeneration: 2,
  assessmentId: "assessment-v2",
  assessmentGeneration: 3,
  scopeHash: canonical.scopeHash,
  audioAllowed: true,
  recordingBoundary: "SERVICE_AREA_ONLY",
  participantPlan: "assigned-service-professional-and-customer",
  contextHash: "b".repeat(64),
  employeeName: "Employee",
  vendorName: "Vendor",
  serviceName: "Outlet Installation",
  recipient: {
    name: "Employee",
    email: "employee@example.com",
    phone: null,
    emailHash: "email-hash",
    phoneHash: null,
    emailMasked: "e***@example.com",
    phoneMasked: null,
  },
  assessmentContractVersion: "recording-assessment-v4-multiscope-safety-v1",
  serviceOrderCurrent: true,
};

function participation(
  overrides: Partial<EmployeeRecordingParticipationResolution> = {},
): EmployeeRecordingParticipationResolution {
  return {
    required: true,
    contractVersion: "employee-recording-participation-v1",
    complete: false,
    status: "REQUIRED",
    evidence: [],
    requiredMembershipIds: ["membership-1"],
    missingMembershipIds: ["membership-1"],
    declinedMembershipIds: [],
    staleMembershipIds: [],
    inactiveMembershipIds: [],
    ...overrides,
  };
}

describe("Employee V2 Service Order presentation", () => {
  it("uses the exact counsel-review-pending policy text and hashes", () => {
    const policy = employeeRecordingParticipationPolicySnapshot();
    expect(policy.identifier).toBe(EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION);
    expect(policy.classification).toBe("COUNSEL_REVIEW_PENDING");
    expect(policy.counselReviewRequired).toBe(true);
    expect(policy.allow).toEqual({
      label: "Allow recording participation",
      text: EMPLOYEE_RECORDING_PARTICIPATION_TEXT.ALLOW,
      textHash: hashOpaqueSecret(EMPLOYEE_RECORDING_PARTICIPATION_TEXT.ALLOW),
    });
    expect(policy.decline.textHash).toBe(
      hashOpaqueSecret(EMPLOYEE_RECORDING_PARTICIPATION_TEXT.DECLINE),
    );
  });

  it("presents the exact current V2 scope without exposing evidence identifiers", () => {
    const view = buildEmployeeV2ServiceOrderView({
      assessment,
      decisionContext,
      participation: participation(),
      membershipId: "membership-1",
      serviceLocation: "123 Main Street",
      serviceOrderCurrent: true,
      blockCode: "EMPLOYEE_RECORDING_PARTICIPATION_REQUIRED",
    });

    expect(view.scope).toMatchObject({
      locationType: "Customer residence",
      serviceLocation: "123 Main Street",
      recordingBoundary: "Service area only",
      audio: "Video with audio",
      intentionalParticipants: ["Assigned service professional", "Customer"],
      stages: ["Starting Condition", "Work in Progress", "Final Result"],
    });
    expect(view.scope.privateUseNotice).toContain("does not authorize Public use");
    expect(view.participation).toMatchObject({
      employeeStatus: "REQUIRED",
      canDecide: true,
    });
    expect(JSON.stringify(view)).not.toContain("assessment-v2");
    expect(JSON.stringify(view)).not.toContain("membership-1");
  });

  it("shows another required Employee as pending without exposing their identity", () => {
    const view = buildEmployeeV2ServiceOrderView({
      assessment,
      decisionContext,
      participation: participation({
        requiredMembershipIds: ["membership-1", "membership-2"],
        missingMembershipIds: ["membership-2"],
        evidence: [{
          membershipId: "membership-1",
          membershipGeneration: 1,
          decisionId: "decision-1",
          decisionEvidenceHash: "c".repeat(64),
          decisionVersion: 1,
          assignmentGeneration: 2,
          assessmentGeneration: 3,
        }],
      }),
      membershipId: "membership-1",
      serviceLocation: null,
      serviceOrderCurrent: true,
      blockCode: "EMPLOYEE_RECORDING_PARTICIPATION_REQUIRED",
    });

    expect(view.participation.employeeStatus).toBe("ALLOWED");
    expect(view.participation.otherRequiredEmployeesPending).toBe(1);
    expect(view.participation.canDecide).toBe(false);
    expect(view.nextState.title).toBe("Waiting for another required participant");
  });

  it("keeps a decline separate from cancellation of the underlying service", () => {
    const state = employeeV2NextState({
      blockCode: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED",
      employeeStatus: "DECLINED",
      otherRequiredEmployeesPending: 0,
    });
    expect(state.status).toBe("BLOCKED");
    expect(state.detail).toContain("does not automatically cancel");
  });

  it("prioritizes another required participant's decline over a pending count", () => {
    const state = employeeV2NextState({
      blockCode: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED",
      employeeStatus: "ALLOWED",
      otherRequiredEmployeesPending: 1,
    });
    expect(state).toMatchObject({
      status: "BLOCKED",
      title: "Recording is not authorized",
    });
  });

  it("rejects a displayed assessment that differs from the decision context", () => {
    expect(() => buildEmployeeV2ServiceOrderView({
      assessment: { ...assessment, generation: 4 },
      decisionContext,
      participation: participation(),
      membershipId: "membership-1",
      serviceLocation: null,
      serviceOrderCurrent: true,
      blockCode: null,
    })).toThrow("V2_EMPLOYEE_SERVICE_ORDER_CONTEXT_STALE");
  });

  it("fails closed when the stored scope hash no longer matches the displayed assessment", () => {
    expect(() => buildEmployeeV2ServiceOrderView({
      assessment: { ...assessment, scopeHash: "d".repeat(64) },
      decisionContext: { ...decisionContext, scopeHash: "d".repeat(64) },
      participation: participation(),
      membershipId: "membership-1",
      serviceLocation: null,
      serviceOrderCurrent: true,
      blockCode: null,
    })).toThrow("V2_EMPLOYEE_SERVICE_ORDER_SCOPE_STALE");
  });
});
