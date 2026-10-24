const RELIANCE_TIME_ZONE = "America/New_York";

function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRelianceDate(value: string | number | Date | null | undefined): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${Number(month)}/${Number(day)}/${year}`;
  }
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", {
    timeZone: RELIANCE_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelianceDateTime(value: string | number | Date | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-US", {
    timeZone: RELIANCE_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function formatRelianceTime(value: string | number | Date | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleTimeString("en-US", {
    timeZone: RELIANCE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
