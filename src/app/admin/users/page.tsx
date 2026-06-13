import { redirect } from "next/navigation";

type LegacyUsersPageProps = {
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

export default async function LegacyUsersPage({ searchParams }: LegacyUsersPageProps) {
  const resolved = (await searchParams) || {};
  const params = new URLSearchParams();
  params.set("tab", "customers");

  appendParam(params, "q", resolved.q);
  appendParam(params, "status", resolved.status);
  appendParam(params, "mode", resolved.mode);
  appendParam(params, "sort", resolved.sort);
  appendParam(params, "showInternal", resolved.showInternal);
  appendParam(params, "includeInternal", resolved.includeInternal);

  redirect(`/admin/accounts?${params.toString()}`);
}
