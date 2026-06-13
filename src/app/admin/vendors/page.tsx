import { redirect } from "next/navigation";

type LegacyVendorsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === "string" && entry.trim()) params.append(key, entry.trim());
    });
    return;
  }
  if (typeof value === "string" && value.trim()) {
    params.set(key, value.trim());
  }
}

function resolveTab(resolved: Record<string, string | string[] | undefined>) {
  const targetType = Array.isArray(resolved.targetType)
    ? String(resolved.targetType[0] || "").trim().toLowerCase()
    : String(resolved.targetType || "").trim().toLowerCase();
  const status = Array.isArray(resolved.status)
    ? String(resolved.status[0] || "").trim().toLowerCase()
    : String(resolved.status || resolved.accountStatus || "").trim().toLowerCase();

  if (targetType === "user") return "customers";
  if (status === "restricted" || status === "suspended" || status === "banned" || status === "deactivated" || status === "archived_inactive") {
    return "restricted";
  }
  return "vendors";
}

export default async function LegacyVendorsPage({ searchParams }: LegacyVendorsPageProps) {
  const resolved = (await searchParams) || {};
  const params = new URLSearchParams();
  params.set("tab", resolveTab(resolved));

  appendParam(params, "q", resolved.q);
  appendParam(params, "status", resolved.status || resolved.accountStatus);
  appendParam(params, "mode", resolved.mode);
  appendParam(params, "sort", resolved.sort);
  appendParam(params, "targetType", resolved.targetType);
  appendParam(params, "showInternal", resolved.showInternal);
  appendParam(params, "includeInternal", resolved.includeInternal);

  redirect(`/admin/accounts?${params.toString()}`);
}
