export type EmployeeRuntimeErrorContext =
  | "jobs"
  | "pair"
  | "start"
  | "stage"
  | "complete";

const PAUSED_DATABASE_PATTERN =
  /monthly free amount allowance|paused for the remainder of the month|continue using database with additional charges|database is paused/i;

const DEFAULT_ERROR_MESSAGES: Record<EmployeeRuntimeErrorContext, string> = {
  jobs: "Failed to fetch assigned employee jobs",
  pair: "Failed to pair employee device",
  start: "Failed to start employee job",
  stage: "Failed to mark stage complete",
  complete: "Failed to complete employee job",
};

const TEMPORARY_UNAVAILABLE_MESSAGES: Record<EmployeeRuntimeErrorContext, string> = {
  jobs:
    "Assigned jobs are temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  pair:
    "Device pairing is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  start:
    "Starting this job is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  stage:
    "Saving this video stage is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
  complete:
    "Submitting this job for manager review is temporarily unavailable because the connected database is paused. Try again after the database resumes.",
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
  body: { error: string; details?: string; code?: string };
} {
  const details = getErrorMessage(error);
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
      ...(details ? { details } : {}),
    },
  };
}
