export function normalizeEmployeeJobStatusLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "PENDING") return "Pending";
  if (normalized === "CONFIRMED") return "In Progress";
  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "AWAITING_REVIEW") return "Awaiting Review";
  if (normalized === "COMPLETED") return "Completed";
  if (normalized === "REJECTED" || normalized === "NEEDS_CHANGES") return "Needs Changes";
  return (
    normalized
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown"
  );
}

export function shouldShowEmployeeStartButton(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "PENDING";
}
