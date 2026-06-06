import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminMediaModerationQueue } from "@/lib/admin-media-moderation-queue";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import AdminMediaModerationClient from "./AdminMediaModerationClient";

export default async function AdminMediaModerationPage() {
  const requestHeaders = await headers();

  await requireAdmin(
    new Request("http://localhost/admin/media-moderation", {
      headers: requestHeaders,
    })
  );

  try {
    const packages = await getAdminMediaModerationQueue({ limit: 20 });
    return (
      <AdminMediaModerationClient
        initialPackages={packages as any}
        initialAiModerationEnabled={isAiFeatureEnabled("moderation_assistant")}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load moderation queue";
    return (
      <AdminMediaModerationClient
        initialPackages={[]}
        initialError={message}
        initialAiModerationEnabled={isAiFeatureEnabled("moderation_assistant")}
      />
    );
  }
}
