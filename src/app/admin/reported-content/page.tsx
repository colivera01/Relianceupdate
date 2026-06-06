import AdminReportedContentClient from "./AdminReportedContentClient";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";

export default function AdminReportedContentPage() {
  return (
    <AdminReportedContentClient
      initialAiDisputeSummaryEnabled={isAiFeatureEnabled("dispute_summary_assistant")}
    />
  );
}
