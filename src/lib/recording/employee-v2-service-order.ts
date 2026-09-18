import { hashOpaqueSecret } from "@/lib/consent/token";
import type { EmployeeDecisionContext } from "@/lib/employee-decision-verification";
import {
  EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION,
  EMPLOYEE_RECORDING_PARTICIPATION_TEXT,
  type EmployeeRecordingParticipationResolution,
} from "@/lib/employee-recording-participation";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  type ExpectedPerson,
  type IntendedSubject,
} from "@/lib/recording/assessment-v2";

export const EMPLOYEE_V2_SERVICE_ORDER_CONTRACT_VERSION =
  "employee-v2-service-order-runtime-v1" as const;

export const EMPLOYEE_V2_RUNTIME_ACTIVATION_STATE =
  "DORMANT_REQUIRES_EXPLICIT_V2_CONTEXT" as const;

const STAGES = ["Starting Condition", "Work in Progress", "Final Result"] as const;

const SUBJECT_LABELS: Record<IntendedSubject, string> = {
  SERVICE_AREA_OR_EQUIPMENT: "Service area or equipment",
  EXISTING_CONDITION_OR_DAMAGE: "Existing condition or damage",
  WORK_BEING_PERFORMED: "Work being performed",
  COMPLETED_WORK_OR_FINAL_CONDITION: "Completed work or final condition",
  NECESSARY_SURROUNDING_AREA: "Necessary surrounding area",
  SERVICE_PARTICIPANTS: "Approved service participants",
  OTHER: "Other approved subject",
};

const PEOPLE_LABELS: Record<ExpectedPerson, string> = {
  NO_IDENTIFIABLE_PEOPLE: "No identifiable people",
  ASSIGNED_SERVICE_PROFESSIONAL: "Assigned service professional",
  CUSTOMER: "Customer",
  OTHER_ADULT_SERVICE_PARTICIPANT: "Another adult service participant",
  BYSTANDER_NONPARTICIPANT: "Bystander or nonparticipant",
  MINOR: "Minor",
};

export type EmployeeV2ServiceOrderView = {
  contractVersion: typeof EMPLOYEE_V2_SERVICE_ORDER_CONTRACT_VERSION;
  contextHash: string;
  serviceOrderCurrent: boolean;
  scope: {
    locationType: string;
    serviceLocation: string | null;
    recordingBoundary: string;
    boundaryExplanation: string | null;
    audio: "Video only" | "Video with audio";
    intentionalParticipants: string[];
    recordingSubjects: string[];
    stages: readonly string[];
    privateUseNotice: string;
  };
  participation: {
    required: boolean;
    employeeStatus: "ALLOWED" | "REQUIRED" | "DECLINED" | "STALE";
    otherRequiredEmployeesPending: number;
    canDecide: boolean;
  };
  policy: {
    identifier: typeof EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION;
    classification: "COUNSEL_REVIEW_PENDING";
    counselReviewRequired: true;
    allow: { label: string; text: string; textHash: string };
    decline: { label: string; text: string; textHash: string };
  };
  nextState: {
    status:
      | "ACTION_REQUIRED"
      | "WAITING"
      | "READY"
      | "BLOCKED"
      | "SCOPE_CHANGE_REQUIRED";
    title: string;
    detail: string;
  };
};

export function employeeRecordingParticipationPolicySnapshot(): EmployeeV2ServiceOrderView["policy"] {
  return {
    identifier: EMPLOYEE_RECORDING_PARTICIPATION_POLICY_VERSION,
    classification: "COUNSEL_REVIEW_PENDING",
    counselReviewRequired: true,
    allow: {
      label: "Allow recording participation",
      text: EMPLOYEE_RECORDING_PARTICIPATION_TEXT.ALLOW,
      textHash: hashOpaqueSecret(EMPLOYEE_RECORDING_PARTICIPATION_TEXT.ALLOW),
    },
    decline: {
      label: "Decline recording participation",
      text: EMPLOYEE_RECORDING_PARTICIPATION_TEXT.DECLINE,
      textHash: hashOpaqueSecret(EMPLOYEE_RECORDING_PARTICIPATION_TEXT.DECLINE),
    },
  };
}

function locationLabel(value: string): string {
  if (value === "VENDOR_BUSINESS") return "Vendor business";
  if (value === "CUSTOMER_RESIDENCE") return "Customer residence";
  if (value === "CUSTOMER_BUSINESS") return "Customer business";
  return "Approved service location";
}

function boundaryLabel(value: string): string {
  return value === "NECESSARY_SURROUNDINGS"
    ? "Service area and necessary surroundings"
    : "Service area only";
}

function employeeStatus(
  participation: EmployeeRecordingParticipationResolution,
  membershipId: string,
): EmployeeV2ServiceOrderView["participation"]["employeeStatus"] {
  if (participation.evidence.some((row) => row.membershipId === membershipId)) {
    return "ALLOWED";
  }
  if (participation.declinedMembershipIds.includes(membershipId)) return "DECLINED";
  if (
    participation.staleMembershipIds.includes(membershipId) ||
    participation.inactiveMembershipIds.includes(membershipId)
  ) {
    return "STALE";
  }
  return "REQUIRED";
}

export function employeeV2NextState(input: {
  blockCode: string | null | undefined;
  employeeStatus: EmployeeV2ServiceOrderView["participation"]["employeeStatus"];
  otherRequiredEmployeesPending: number;
}): EmployeeV2ServiceOrderView["nextState"] {
  if (input.employeeStatus === "DECLINED") {
    return {
      status: "BLOCKED",
      title: "Recording participation declined",
      detail:
        "Reliance recording remains locked. This choice does not automatically cancel the underlying service.",
    };
  }
  const code = String(input.blockCode || "");
  if (["CUSTOMER_RECORDING_DECLINED", "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED"].includes(code)) {
    return {
      status: "BLOCKED",
      title: "Recording is not authorized",
      detail: "The current recording request has a recorded decline and cannot proceed.",
    };
  }
  if (input.employeeStatus === "STALE") {
    return {
      status: "ACTION_REQUIRED",
      title: "Review the current recording request",
      detail:
        "The assignment or recording scope changed. Review the current Service Order and make a new participation choice.",
    };
  }
  if (input.employeeStatus === "REQUIRED") {
    return {
      status: "ACTION_REQUIRED",
      title: "Your recording choice is required",
      detail:
        "Verify your identity, then allow or decline recording participation for this Service Order.",
    };
  }
  if (input.otherRequiredEmployeesPending > 0) {
    return {
      status: "WAITING",
      title: "Waiting for another required participant",
      detail:
        "Your choice is saved. Recording remains locked until every required assigned employee makes their own choice.",
    };
  }

  if (
    [
      "VERIFIED_PERMISSION_REQUIRED",
      "CUSTOMER_RECORDING_AUTH_REQUIRED",
      "PERMISSION_RECIPIENT_CORRECTION_REQUIRED",
    ].includes(code)
  ) {
    return {
      status: "WAITING",
      title: "Waiting for Customer recording authorization",
      detail: "Recording remains locked until the current Customer authorization requirement is complete.",
    };
  }
  if (["SERVICE_ORDER_RELEASE_REQUIRED", "EMPLOYEE_ASSIGNMENT_REQUIRED"].includes(code)) {
    return {
      status: "WAITING",
      title: "Waiting for the current Service Order",
      detail: "The Vendor Manager must release the Service Order for the current assignment and recording request.",
    };
  }
  if (["EMPLOYEE_CERTIFICATION_REQUIRED", "LOCATION_VERIFICATION_REQUIRED"].includes(code)) {
    return {
      status: "ACTION_REQUIRED",
      title: "Recording participation saved",
      detail:
        code === "EMPLOYEE_CERTIFICATION_REQUIRED"
          ? "Review and confirm the current recording scope before opening a recording stage."
          : "Verify the current service location from this device before opening the selected stage.",
    };
  }
  if (code.startsWith("V2_RUNTIME_SAFETY_MATERIAL") || code === "V2_PARTICIPANT_PLAN_CHANGE_REQUIRED") {
    return {
      status: "SCOPE_CHANGE_REQUIRED",
      title: "The recording plan must be updated",
      detail: "Do not record. The Vendor Manager must establish a new approved recording scope.",
    };
  }
  if (code.startsWith("V2_RUNTIME_SAFETY") || code === "LOCATION_EXCEPTION_PENDING") {
    return {
      status: code === "LOCATION_EXCEPTION_PENDING" ? "WAITING" : "ACTION_REQUIRED",
      title: code === "LOCATION_EXCEPTION_PENDING" ? "Location review is pending" : "A stage safety check is required",
      detail:
        code === "LOCATION_EXCEPTION_PENDING"
          ? "Recording remains locked while the location exception is reviewed."
          : "Complete the current stage safety and location checks before recording.",
    };
  }
  if (code) {
    return {
      status: "BLOCKED",
      title: "Recording is not ready",
      detail: "Complete the current Service Order requirement before recording.",
    };
  }
  return {
    status: "READY",
    title: "Ready for the current recording stage",
    detail: "The server confirmed the current authorization and runtime requirements.",
  };
}

export function buildEmployeeV2ServiceOrderView(input: {
  assessment: any;
  decisionContext: EmployeeDecisionContext;
  participation: EmployeeRecordingParticipationResolution;
  membershipId: string;
  serviceLocation: string | null;
  serviceOrderCurrent: boolean;
  blockCode: string | null | undefined;
}): EmployeeV2ServiceOrderView {
  if (input.assessment?.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    throw new Error("V2_EMPLOYEE_SERVICE_ORDER_ASSESSMENT_REQUIRED");
  }
  if (input.decisionContext.contextHash.length !== 64) {
    throw new Error("V2_EMPLOYEE_SERVICE_ORDER_CONTEXT_INVALID");
  }
  if (
    input.decisionContext.assessmentId !== input.assessment.id ||
    input.decisionContext.assessmentGeneration !== Number(input.assessment.generation) ||
    input.decisionContext.scopeHash !== input.assessment.scopeHash
  ) {
    throw new Error("V2_EMPLOYEE_SERVICE_ORDER_CONTEXT_STALE");
  }
  const canonical = parseRecordingAssessmentV2(JSON.parse(input.assessment.scopeJson));
  if (canonical.scopeHash !== input.assessment.scopeHash) {
    throw new Error("V2_EMPLOYEE_SERVICE_ORDER_SCOPE_STALE");
  }
  const ownStatus = employeeStatus(input.participation, input.membershipId);
  const otherRequiredEmployeesPending = input.participation.requiredMembershipIds.filter(
    (membershipId) =>
      membershipId !== input.membershipId &&
      !input.participation.evidence.some((row) => row.membershipId === membershipId),
  ).length;
  return {
    contractVersion: EMPLOYEE_V2_SERVICE_ORDER_CONTRACT_VERSION,
    contextHash: input.decisionContext.contextHash,
    serviceOrderCurrent: input.serviceOrderCurrent,
    scope: {
      locationType: locationLabel(canonical.assessment.location.type),
      serviceLocation: input.serviceLocation,
      recordingBoundary: boundaryLabel(canonical.assessment.recordingArea.boundary),
      boundaryExplanation: canonical.assessment.recordingArea.explanation || null,
      audio:
        canonical.assessment.recordingFormat === "VIDEO_AUDIO"
          ? "Video with audio"
          : "Video only",
      intentionalParticipants: canonical.assessment.expectedPeople.map(
        (person) => PEOPLE_LABELS[person],
      ),
      recordingSubjects: canonical.assessment.intendedSubjects.map(
        (subject) =>
          subject === "OTHER" && canonical.assessment.otherSubjectDescription
            ? canonical.assessment.otherSubjectDescription
            : SUBJECT_LABELS[subject],
      ),
      stages: STAGES,
      privateUseNotice:
        "This job-specific choice permits Reliance recording only. It does not authorize Public use.",
    },
    participation: {
      required: input.participation.required,
      employeeStatus: ownStatus,
      otherRequiredEmployeesPending,
      canDecide:
        input.serviceOrderCurrent &&
        ownStatus !== "ALLOWED" &&
        ![
          "CUSTOMER_RECORDING_DECLINED",
          "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED",
        ].includes(String(input.blockCode || "")),
    },
    policy: employeeRecordingParticipationPolicySnapshot(),
    nextState: employeeV2NextState({
      blockCode: input.blockCode,
      employeeStatus: ownStatus,
      otherRequiredEmployeesPending,
    }),
  };
}
