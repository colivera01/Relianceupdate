"use client";

import AdminReportedContentClient from "@/app/admin/reported-content/AdminReportedContentClient";
import { ReportContentDialog } from "@/components/reports/ReportContentDialog";
import { PackageVisibilityCard } from "@/components/service-video/PackageVisibilityCard";

export default function ContentReportingFixture() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <section aria-labelledby="private-report-heading" className="space-y-3">
        <h1 id="private-report-heading" className="text-2xl font-semibold">Customer Private Proof</h1>
        <ReportContentDialog
          targetType="media_asset"
          targetId="asset-private"
          isSignedIn
          triggerLabel="Report private video"
          title="Report this Private Proof stage"
        />
      </section>

      <section aria-labelledby="public-report-heading" className="space-y-3">
        <h2 id="public-report-heading" className="text-2xl font-semibold">Public Service Video</h2>
        <ReportContentDialog
          targetType="media_asset"
          targetId="asset-public"
          isSignedIn
          triggerLabel="Report public video"
          title="Report this Public Service Video stage"
        />
      </section>

      <section aria-label="Customer visibility restriction">
        <PackageVisibilityCard bookingId="booking-report" role="customer" />
      </section>

      <section aria-label="Admin report queue">
        <AdminReportedContentClient initialAiDisputeSummaryEnabled={false} />
      </section>
    </main>
  );
}
