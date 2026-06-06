import Link from "next/link";
import { headers } from "next/headers";
import {
  Activity,
  ClipboardList,
  FileWarning,
  ShieldAlert,
  Sparkles,
  Video,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import {
  buildCompleteMediaModerationPackages,
  countPendingMediaModerationPackages,
} from "@/lib/admin-media-moderation-packages";
import { resolveVendorJobVideoStageFromSession } from "@/lib/vendor-job-video-stages";
import { countableMediaAssetWhere, countableReviewWhere } from "@/lib/metrics-exclusion";
import { launchExcludedUserIds, launchExcludedVendorIds } from "@/lib/internal-identities";
import { isTransientDbConnectivityError, withTransientDbRetry } from "@/lib/transient-db-errors";
import { AI_FEATURE_KEYS } from "@/lib/ai/config";
import {
  buildAiActivityReport,
  formatAiFeatureLabel,
  normalizeAiActivityFeatureFilter,
} from "@/lib/ai/reporting";

type ActivityPageProps = {
  searchParams?: Promise<{
    aiFeature?: string | string[];
  }>;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null) {
  if (value == null) return "N/A";
  return `${value}%`;
}

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return "Unknown time";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const requestHeaders = await headers();
  const authHeaders = new Headers();
  for (const headerName of [
    "cookie",
    "authorization",
    "x-user-id",
    "x-user-role",
    "x-admin",
  ]) {
    const value = requestHeaders.get(headerName);
    if (value) authHeaders.set(headerName, value);
  }
  await requireAdmin(
    new Request("http://localhost/admin/activity", {
      headers: authHeaders,
    })
  );

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const excludedUserIds = launchExcludedUserIds();
  const excludedVendorIds = launchExcludedVendorIds();
  const aiFeatureFilter = normalizeAiActivityFeatureFilter(
    Array.isArray(resolvedSearchParams.aiFeature)
      ? resolvedSearchParams.aiFeature[0]
      : resolvedSearchParams.aiFeature
  );

  let recentAuditEvents = 0;
  let pendingReviewModeration = 0;
  let openReportedContent = 0;
  let latestAuditEvents: Array<{
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    actorUserId: string;
    createdAt: Date | string;
  }> = [];
  let mediaAssets: any[] = [];
  let aiResponseLogs: Array<{
    id: string;
    actionType: string;
    entityId: string;
    actorUserId: string;
    metadata: string | null;
    createdAt: Date | string;
  }> = [];
  let aiFeedbackLogs: Array<{
    id: string;
    actionType: string;
    entityId: string;
    actorUserId: string;
    metadata: string | null;
    createdAt: Date | string;
  }> = [];
  let aiErrorLogs: Array<{
    id: string;
    actionType: string;
    entityId: string;
    actorUserId: string;
    metadata: string | null;
    createdAt: Date | string;
  }> = [];
  let activityUnavailable = false;

  try {
    [
      recentAuditEvents,
      pendingReviewModeration,
      openReportedContent,
      latestAuditEvents,
      mediaAssets,
      aiResponseLogs,
      aiFeedbackLogs,
      aiErrorLogs,
    ] =
      await withTransientDbRetry(() =>
        Promise.all([
          (prisma as any).adminAuditLog.count({
            where: {
              createdAt: { gte: sevenDaysAgo },
            },
          }),
          prisma.review.count({
            where: countableReviewWhere({
              moderationStatus: "pending_review",
            }),
          }),
          (prisma as any).contentReport.count({
            where: {
              status: { in: ["open", "triaged", "under_review"] },
              NOT: [
                { vendorId: { in: excludedVendorIds } },
                { reportedVendorId: { in: excludedVendorIds } },
                { reporterVendorId: { in: excludedVendorIds } },
                { reportedUserId: { in: excludedUserIds } },
                { reporterUserId: { in: excludedUserIds } },
              ],
            },
          }),
          (prisma as any).adminAuditLog.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              actionType: true,
              entityType: true,
              entityId: true,
              actorUserId: true,
              createdAt: true,
            },
          }),
          (prisma as any).mediaAsset.findMany({
            where: countableMediaAssetWhere(),
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              vendorId: true,
              moderationStatus: true,
              visibilityStatus: true,
              createdAt: true,
              uploadedByMembershipId: true,
              mediaSession: {
                select: {
                  title: true,
                  vendorJobVideoStage: true,
                  sessionType: true,
                  booking: {
                    select: {
                      id: true,
                      title: true,
                      clientName: true,
                      status: true,
                    },
                  },
                  service: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          }),
          (prisma as any).adminAuditLog.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
              entityType: "ai_run",
              actionType: "ai_response",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              actionType: true,
              entityId: true,
              actorUserId: true,
              metadata: true,
              createdAt: true,
            },
          }),
          (prisma as any).adminAuditLog.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
              entityType: "ai_run",
              actionType: "ai_feedback",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              actionType: true,
              entityId: true,
              actorUserId: true,
              metadata: true,
              createdAt: true,
            },
          }),
          (prisma as any).adminAuditLog.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
              entityType: "ai_run",
              actionType: "ai_error",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              actionType: true,
              entityId: true,
              actorUserId: true,
              metadata: true,
              createdAt: true,
            },
          }),
        ])
      );
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    activityUnavailable = true;
  }

  const pendingVideoPackages = activityUnavailable
    ? 0
    : countPendingMediaModerationPackages(
        buildCompleteMediaModerationPackages(
          mediaAssets.map((asset: any) => {
            const session = asset.mediaSession;
            const stageKey = resolveVendorJobVideoStageFromSession({
              vendorJobVideoStage: session?.vendorJobVideoStage,
              sessionType: session?.sessionType,
            });

            return {
              title: session?.title || session?.booking?.title || "Untitled Media",
              vendorId: asset.vendorId,
              bookingId: session?.booking?.id || null,
              jobTitle: session?.booking?.title || null,
              bookingStatus: session?.booking?.status || null,
              clientName: session?.booking?.clientName || null,
              serviceName: session?.service?.name || null,
              uploadedByMembershipId: asset.uploadedByMembershipId || null,
              vendorJobVideoStageKey: stageKey,
              moderationStatus: asset.moderationStatus,
              visibilityStatus: asset.visibilityStatus,
              createdAt: asset.createdAt,
            };
          })
        )
      );

  const aiReport = buildAiActivityReport({
    responseLogs: aiResponseLogs,
    feedbackLogs: aiFeedbackLogs,
    errorLogs: aiErrorLogs,
    recentRunLimit: 8,
    featureFilter: aiFeatureFilter,
  });

  const aiFeatureOptions = [
    { value: "all", label: "All AI tools" },
    ...AI_FEATURE_KEYS.map((feature) => ({
      value: feature,
      label: formatAiFeatureLabel(feature),
    })),
  ];

  const buildAiActivityHref = (feature: string) =>
    feature === "all" ? "/admin/activity" : `/admin/activity?aiFeature=${encodeURIComponent(feature)}`;

  const buildAiExportHref = (format: "json" | "csv") =>
    `/api/admin/activity/ai-export?format=${format}&aiFeature=${encodeURIComponent(aiFeatureFilter)}`;

  const cards = [
    {
      title: "Recent Audit Events",
      value: formatCount(recentAuditEvents),
      description: "Persisted admin audit events recorded over the last 7 days.",
      icon: Activity,
    },
    {
      title: "Pending Review Moderation",
      value: formatCount(pendingReviewModeration),
      description: "Customer reviews still waiting on an admin decision.",
      icon: ClipboardList,
    },
    {
      title: "Pending Video Packages",
      value: formatCount(pendingVideoPackages),
      description: "Complete service video sets still waiting on moderation.",
      icon: Video,
    },
    {
      title: "Open Reported Content",
      value: formatCount(openReportedContent),
      description: "Open, triaged, or under-review reports needing follow-up.",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Activity Monitoring</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Live operational snapshot for review queues, moderation pressure, and recent admin actions.
          This page stays launch-honest and links directly to the tools that resolve issues.
        </p>
      </div>

      {activityUnavailable ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Activity monitoring is temporarily unavailable</CardTitle>
            <CardDescription>
              Reliance could not reach the service database during this activity check.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-950">
            <p>
              The live activity snapshot could not finish loading because the database connection
              temporarily failed. Use the admin tools below once the connection stabilizes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/dashboard" className="font-medium text-blue-700 underline">
                Open Admin Dashboard
              </Link>
              <Link href="/admin/audit-logs" className="font-medium text-blue-700 underline">
                Open Audit Logs
              </Link>
              <Link href="/admin/reports" className="font-medium text-blue-700 underline">
                Open Reports
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!activityUnavailable ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, value, description, icon: Icon }) => (
              <Card key={title}>
                <CardHeader className="pb-3">
                  <CardDescription>{title}</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Icon className="h-5 w-5 text-primary" />
                    {value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {description}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Admin Activity
                </CardTitle>
                <CardDescription>
                  Latest persisted admin actions from the audit log.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestAuditEvents.length ? (
                  latestAuditEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{event.actionType}</Badge>
                        <span className="font-medium text-slate-900">
                          {event.entityType}
                        </span>
                        <span className="text-muted-foreground">
                          {event.entityId}
                        </span>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        Actor: {event.actorUserId} - {formatTimestamp(event.createdAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No recent admin audit events were recorded in the last 7 days.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-primary" />
                  Operator Actions
                </CardTitle>
                <CardDescription>
                  Jump to the live tools that resolve queue pressure quickly.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <Link href="/admin/reviews" className="font-medium text-blue-600 underline">
                  Open Review Moderation
                </Link>
                <Link href="/admin/media-moderation" className="font-medium text-blue-600 underline">
                  Open Media Moderation
                </Link>
                <Link href="/admin/reported-content" className="font-medium text-blue-600 underline">
                  Open Reported Content
                </Link>
                <Link href="/admin/audit-logs" className="font-medium text-blue-600 underline">
                  Open Audit Logs
                </Link>
                <Link href="/admin/reports" className="font-medium text-blue-600 underline">
                  Open Reports &amp; Analytics
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Assist Monitoring
                </CardTitle>
                <CardDescription>
                  Seven-day view of AI recommendation usage, operator follow-through, and failure
                  signals across the current Reliance assist tools.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-900">Filter by AI tool</div>
                      <div className="flex flex-wrap gap-2">
                        {aiFeatureOptions.map((option) => {
                          const active = aiFeatureFilter === option.value;
                          return (
                            <Link
                              key={option.value}
                              href={buildAiActivityHref(option.value)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                active
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                              }`}
                            >
                              {option.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildAiExportHref("json")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Export JSON
                      </Link>
                      <Link
                        href={buildAiExportHref("csv")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Export CSV
                      </Link>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Current filter:{" "}
                    <span className="font-medium text-slate-900">
                      {
                        aiFeatureOptions.find((option) => option.value === aiFeatureFilter)?.label
                      }
                    </span>
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      AI Runs
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatCount(aiReport.responseCount)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Successful AI responses recorded
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Feedback Coverage
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatPercent(aiReport.feedbackCoveragePct)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Runs with accepted, overridden, or ignored feedback
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Follow Rate
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatPercent(aiReport.followRatePct)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Accepted vs overridden recommendations
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      AI Errors
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatCount(aiReport.errorCount)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Logged request failures
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium text-slate-900">Feedback outcomes</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">Followed: {formatCount(aiReport.acceptedCount)}</Badge>
                      <Badge variant="secondary">Overrode: {formatCount(aiReport.overrodeCount)}</Badge>
                      <Badge variant="secondary">Ignored: {formatCount(aiReport.ignoredCount)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Use these outcomes to spot prompt drift before expanding AI scope.
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium text-slate-900">Feature breakdown</div>
                    <div className="mt-3 space-y-3">
                      {aiReport.featureSummaries.length ? (
                        aiReport.featureSummaries.map((summary) => (
                          <div
                            key={summary.feature}
                            className="rounded-md border border-dashed p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-slate-900">
                                {summary.featureLabel}
                              </span>
                              <Badge variant="outline">
                                Runs: {formatCount(summary.responseCount)}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>Followed {formatCount(summary.acceptedCount)}</span>
                              <span>Overrode {formatCount(summary.overrodeCount)}</span>
                              <span>Ignored {formatCount(summary.ignoredCount)}</span>
                              <span>Errors {formatCount(summary.errorCount)}</span>
                              <span>Follow rate {formatPercent(summary.followRatePct)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No AI activity was recorded in the last 7 days.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Recent AI Runs
                </CardTitle>
                <CardDescription>
                  Latest successful AI responses, with any recorded operator outcome attached.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiReport.recentRuns.length ? (
                  aiReport.recentRuns.map((run) => (
                    <div key={run.aiRunId} className="rounded-lg border p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{run.featureLabel}</Badge>
                        <span className="font-medium text-slate-900">{run.operation}</span>
                        {run.feedbackOutcome ? (
                          <Badge variant="outline">
                            {run.feedbackOutcome === "accepted"
                              ? "Followed"
                              : run.feedbackOutcome === "overrode"
                                ? "Overrode"
                                : "Ignored"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No feedback yet</Badge>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <div>Entity: {run.relatedEntityId}</div>
                        <div>
                          Model: {run.model || "Unknown"} - Prompt: {run.promptVersion || "Unknown"}
                        </div>
                        <div>
                          Duration: {formatDuration(run.durationMs)} - Tokens:{" "}
                          {run.totalTokens != null ? formatCount(run.totalTokens) : "N/A"}
                        </div>
                        <div>
                          Actor: {run.actorUserId} - {formatTimestamp(run.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No successful AI response logs were recorded in the last 7 days.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
