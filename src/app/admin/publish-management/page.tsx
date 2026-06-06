import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminPublishOverview } from "@/lib/admin-publish-controls";
import PublishManagementClient from "./PublishManagementClient";

type PublishManagementPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export default async function AdminPublishManagementPage({
  searchParams,
}: PublishManagementPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = normalizeSearchValue(resolvedSearchParams.q);
  const requestHeaders = await headers();

  await requireAdmin(
    new Request("http://localhost/admin/publish-management", {
      headers: requestHeaders,
    })
  );

  const { vendors, services } = await getAdminPublishOverview(query);

  return (
    <PublishManagementClient
      initialQuery={query}
      initialServices={services}
      initialVendors={vendors}
    />
  );
}
