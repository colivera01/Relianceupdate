export type EmployeeRuntimeErrorContext =
  | "jobs"
  | "pair"
  | "start"
  | "stage"
  | "complete"
  | "decision";

const PAUSED_DATABASE_PATTERN =
  /monthly free amount allowance|paused for the remainder of the month|continue using database with additional charges|database is paused/i;

const DEFAULT_ERROR_MESSAGES: Record<EmployeeRuntimeErrorContext, string> = {
  jobs: "Failed to fetch assigned employee jobs",
  pair: "Failed to prepare employee phone",
  start: "Failed to start employee job",
  stage: "Failed to mark stage complete",
  complete: "Failed to complete employee job",
  decision: "Your recording-participation choice could not be saved.",
};

const TEMPORARY_UNAVAILABLE_MESSAGES: Record<EmployeeRuntimeErrorContext, string> = {
  jobs:
    "Assigned jobs are temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  pair:
    "Phone video setup is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  start:
    "Starting this job is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  stage:
    "Saving this video stage is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  complete:
    "Submitting this job for manager review is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  decision:
    "Recording participation is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

export function isPausedEmployeeDatabaseError(error: unknown): boolean {
  return PAUSED_DATABASE_PATTERN.test(getErrorMessage(error));
}

export function getEmployeeRuntimeErrorResponse(
  context: EmployeeRuntimeErrorContext,
  error: unknown
): {
  status: number;
  body: { error: string; code?: string };
} {
  if (isPausedEmployeeDatabaseError(error)) {
    return {
      status: 503,
      body: {
        error: TEMPORARY_UNAVAILABLE_MESSAGES[context],
        code: "EMPLOYEE_RUNTIME_TEMPORARILY_UNAVAILABLE",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: DEFAULT_ERROR_MESSAGES[context],
    },
  };
}

export function getEmployeeDecisionErrorResponse(
  error: unknown,
  phase: "verification" | "decision" = "decision",
): {
  status: number;
  body: { success: false; code: string; error: string; staleContext?: boolean };
} {
  const code = getErrorMessage(error) || "EMPLOYEE_RECORDING_PARTICIPATION_FAILED";
  if (code === "Unauthorized" || code === "EMPLOYEE_SERVICE_ORDER_LINK_INVALID") {
    return {
      status: 401,
      body: {
        success: false,
        code: "EMPLOYEE_SERVICE_ORDER_ACCESS_REQUIRED",
        error: "This Service Order link is expired or no longer current. Ask the Vendor Manager for the current link.",
      },
    };
  }
  if (
    code.includes("FORBIDDEN") ||
    code === "EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED"
  ) {
    return {
      status: 403,
      body: {
        success: false,
        code: "EMPLOYEE_SERVICE_ORDER_ACCESS_FORBIDDEN",
        error: "This verified Employee access does not match the current Service Order.",
      },
    };
  }
  if (
    code.includes("STALE") ||
    code === "EMPLOYEE_V2_SERVICE_ORDER_RELEASE_STALE"
  ) {
    return {
      status: 409,
      body: {
        success: false,
        code: "EMPLOYEE_SERVICE_ORDER_CONTEXT_CHANGED",
        error: "This Service Order changed after it was opened. Reload the current Service Order or use the newest link from the Vendor Manager.",
        staleContext: true,
      },
    };
  }
  if (code.includes("OTP_") || code.includes("VERIFICATION")) {
    return {
      status: 422,
      body: {
        success: false,
        code: "EMPLOYEE_IDENTITY_VERIFICATION_FAILED",
        error: "Employee identity verification could not be completed. Check the code and try again.",
      },
    };
  }
  if (code === "EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE") {
    return {
      status: 422,
      body: {
        success: false,
        code,
        error: "That Employee verification channel is not currently available. Choose an available channel.",
      },
    };
  }
  if (code === "EMPLOYEE_DECISION_RESEND_COOLDOWN") {
    return {
      status: 429,
      body: {
        success: false,
        code,
        error: "A verification code was sent recently. Wait one minute before requesting another code.",
      },
    };
  }
  if (code.includes("SESSION")) {
    return {
      status: 401,
      body: {
        success: false,
        code: "EMPLOYEE_DECISION_VERIFICATION_REQUIRED",
        error: "Verify your Employee identity again before saving this choice.",
      },
    };
  }
  const runtime = getEmployeeRuntimeErrorResponse("decision", error);
  if (phase === "verification") {
    return {
      status: runtime.status,
      body: {
        success: false,
        code: runtime.body.code || "EMPLOYEE_IDENTITY_VERIFICATION_FAILED",
        error:
          runtime.body.code === "EMPLOYEE_RUNTIME_TEMPORARILY_UNAVAILABLE"
            ? runtime.body.error
            : "Employee identity verification could not be prepared. Reload the current Service Order and verify again.",
      },
    };
  }
  return {
    status: runtime.status,
    body: {
      success: false,
      code: runtime.body.code || "EMPLOYEE_RECORDING_PARTICIPATION_FAILED",
      error: runtime.body.error,
    },
  };
}
