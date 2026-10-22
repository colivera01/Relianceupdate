export type EmployeeServiceOrderStepState =
  | "checking"
  | "current"
  | "complete"
  | "blocked"
  | "waiting";

export type EmployeeParticipationStatus =
  | "NOT_REQUIRED"
  | "ALLOWED"
  | "REQUIRED"
  | "DECLINED"
  | "STALE";

export type EmployeeServiceOrderStep = {
  label: string;
  detail: string;
  state: EmployeeServiceOrderStepState;
};

export function buildEmployeeServiceOrderSteps(input: {
  legalAssentCurrent: boolean | null;
  participationStatus: EmployeeParticipationStatus;
  safetyAndLocationComplete: boolean;
  completedStageCount: number;
  totalStageCount: number;
}): EmployeeServiceOrderStep[] {
  const participationComplete = ["ALLOWED", "NOT_REQUIRED"].includes(input.participationStatus);
  const participationDeclined = input.participationStatus === "DECLINED";

  return [
    {
      label: "Service Order agreement",
      detail: input.legalAssentCurrent
        ? "Your verified Service Order agreement is complete."
        : input.legalAssentCurrent === null
          ? "Checking your current Service Order agreement."
          : "Review the current documents and verify your agreement before making a recording choice.",
      state: input.legalAssentCurrent
        ? "complete"
        : input.legalAssentCurrent === null
          ? "checking"
          : "current",
    },
    {
      label: "Recording participation for this job",
      detail: participationComplete
        ? "Your verified job-specific choice is complete."
        : participationDeclined
          ? "You declined recording participation for this Service Order."
          : input.legalAssentCurrent
            ? "Allow or decline, then verify using the available contact method shown below."
            : "Available after the Service Order agreement.",
      state: participationComplete
        ? "complete"
        : participationDeclined
          ? "blocked"
          : input.legalAssentCurrent
            ? "current"
            : "waiting",
    },
    {
      label: "Safety and location check",
      detail: input.safetyAndLocationComplete
        ? "The current safety and location check is complete."
        : input.legalAssentCurrent && participationComplete
          ? "Complete the acknowledgments and verify the service location before recording."
          : "Available after recording participation is allowed.",
      state: input.safetyAndLocationComplete
        ? "complete"
        : input.legalAssentCurrent && participationComplete
          ? "current"
          : "waiting",
    },
    {
      label: "Record three short videos",
      detail: input.completedStageCount === input.totalStageCount
        ? "Starting Condition, Work in Progress, and Final Result are saved."
        : input.safetyAndLocationComplete
          ? `${input.completedStageCount} of ${input.totalStageCount} videos saved. Continue with the highlighted stage.`
          : "Available after the safety and location check.",
      state: input.completedStageCount === input.totalStageCount
        ? "complete"
        : input.safetyAndLocationComplete
          ? "current"
          : "waiting",
    },
  ];
}

export function employeeStageLockCopy(input: {
  legalAssentCurrent?: boolean | null;
  correctionRequested: boolean;
  awaitingManagerReview: boolean;
  canonicalResolution?: string | null;
}): string {
  if (input.legalAssentCurrent === null) {
    return "Checking the current Service Order agreement.";
  }
  if (input.legalAssentCurrent === false) {
    return "Complete the Service Order agreement above before choosing recording participation.";
  }
  if (input.correctionRequested) {
    return "This stage is locked because your manager did not request a correction to it.";
  }
  if (input.awaitingManagerReview) {
    return "Uploads are locked while manager review is pending.";
  }
  if (input.canonicalResolution) {
    return `Recording controls are locked. ${input.canonicalResolution}`;
  }
  return "Complete the current Service Order requirements before uploading this video.";
}
