export type AssignmentMetadata = {
  assignedMembershipIds: string[];
  assignedEmployees: string[];
};

export function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseAssignmentMetadata(value: string | null | undefined): AssignmentMetadata {
  const parsed = parseCustomerMetadata(value);
  const assignedMembershipIds = Array.isArray(parsed.vendor_job_assigned_membership_ids)
    ? parsed.vendor_job_assigned_membership_ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    : [];
  const assignedEmployees = Array.isArray(parsed.vendor_job_assigned_employees)
    ? parsed.vendor_job_assigned_employees
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    : [];
  return { assignedMembershipIds, assignedEmployees };
}

export function setStageProgressMetadata(
  value: string | null | undefined,
  stage: "INTRO" | "IN_PROGRESS" | "COMPLETED"
): string {
  const parsed = parseCustomerMetadata(value);
  const current = parsed.vendor_job_stage_progress;
  const normalizedCurrent =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  parsed.vendor_job_stage_progress = {
    ...normalizedCurrent,
    [stage]: "uploaded",
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(parsed);
}
