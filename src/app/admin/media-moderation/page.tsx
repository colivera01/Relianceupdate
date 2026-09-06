import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminMediaModerationQueueResult } from "@/lib/admin-media-moderation-queue";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import AdminMediaModerationClient from "./AdminMediaModerationClient";

export default async function AdminMediaModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const requestHeaders = await headers();
  const query = await searchParams;

  await requireAdmin(
    new Request("http://localhost/admin/media-moderation", {
      headers: requestHeaders,
    })
  );

  try {
    const result = await getAdminMediaModerationQueueResult({
      limit: 200,
      packageId: query.package || null,
    });
    return (
      <AdminMediaModerationClient
        initialPackages={result.packages as any}
        initialDiagnostics={result.diagnostics}
        initialTotalPending={result.totalPending}
        initialTargetPackageId={query.package || ""}
        initialAiModerationEnabled={isAiFeatureEnabled("moderation_assistant")}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load moderation queue";
    return (
      <AdminMediaModerationClient
        initialPackages={[]}
        initialDiagnostics={[]}
        initialError={message}
        initialAiModerationEnabled={isAiFeatureEnabled("moderation_assistant")}
      />
    );
  }
}
