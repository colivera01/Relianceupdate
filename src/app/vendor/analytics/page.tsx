"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Archive,
  CalendarDays,
  HardDrive,
  LockKeyhole,
  Medal,
  MessageSquareText,
  ShieldCheck,
  Star,
  TrendingUp,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorTrustScoreCard } from "@/components/vendor/VendorTrustScoreCard";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";
import {
  deriveVendorAnalyticsMetrics,
  formatStoragePercent,
  formatStorageSize,
  selectMostRecentPublicReview,
  selectTopRatedTeamMember,
} from "@/lib/vendor-analytics";

function formatPercent(value: number) {
  return `${Math.max(0, Math.round(value))}%`;
}

function formatDecimal(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function VendorAnalyticsPage() {
  const { data, loading, error, refetch, approvalPending } = useVendorDashboard();

  const derived = useMemo(() => {
    if (!data) return null;

    const metrics = deriveVendorAnalyticsMetrics(data);

    return {
      ...metrics,
      topPerformer: selectTopRatedTeamMember(data.employeePerformance),
      mostRecentPublicReview: selectMostRecentPublicReview(data.recentReviews),
    };
  }, [data]);

  if (approvalPending) {
    return (
      <div className="space-y-8 px-4 py-8 md:px-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Vendor account pending approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>Your analytics will appear after admin approval.</p>
            <Button asChild>
              <Link href="/vendor/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 px-4 py-8 md:px-8">
        <header className="border-b pb-5">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-6">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading analytics...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data || !derived) {
    return (
      <div className="space-y-8 px-4 py-8 md:px-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">We could not load analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-800">
            <p>{error || "Please try again."}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={refetch}>Try Again</Button>
              <Button asChild variant="outline">
                <Link href="/vendor/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Total service records",
      value: String(derived.totalBookings),
      helper: `${derived.totalClients} distinct clients`,
      icon: CalendarDays,
    },
    {
      label: "Completion rate",
      value: formatPercent(derived.completionRate),
      helper: `${derived.completedJobs} completed from eligible work records`,
      icon: TrendingUp,
    },
    {
      label: "Customer rating",
      value: derived.ratingCount > 0 ? `${formatDecimal(derived.rating)}★` : "Not yet rated",
      helper:
        derived.ratingCount > 0
          ? `${derived.ratingCount} verified customer rating${derived.ratingCount === 1 ? "" : "s"}`
          : "The first verified customer star rating will establish this average.",
      icon: Star,
    },
    {
      label: "Service order approvals",
      value: String(derived.approvedServiceOrders),
      helper: `${derived.pendingServiceOrders} pending Reliance Audit`,
      icon: Video,
    },
  ];

  return (
    <div className="space-y-6 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-5 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Vendor analytics</p>
          <h1 className="mt-2 text-3xl font-semibold">Analytics &amp; Trust</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Monitor finalized Reliance activity, customer feedback, Service Video approvals, and
            operational trends for {data.profile.businessName || "your business"}.
          </p>
        </div>
        <div className="flex max-w-xl gap-3 border-l-2 border-cyan-500/60 pl-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Two separate customer signals</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Customer reviews reflect customer opinion. The Reliance Trust Score uses only
              finalized Reliance workflow, Service Video, and dispute evidence.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-3xl font-semibold tracking-tight">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <VendorTrustScoreCard dashboardData={data} onRefreshDashboard={refetch} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Recent activity and capacity</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Customer-facing signals and private operational measures are labeled separately so
              you can see exactly what each number represents.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Verified rating participation
                </div>
                <Badge variant="outline">Customer signal</Badge>
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {derived.ratingCoverageDenominator > 0
                  ? formatPercent(derived.verifiedRatingCoverage)
                  : "Not yet measurable"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {derived.ratingCoverageDenominator > 0
                  ? `${derived.ratingCoverageNumerator} of ${derived.ratingCoverageDenominator} completed, approved Service Orders received a verified customer star rating.`
                  : "No completed, approved Service Order is currently eligible for this calculation."}
                {" "}Reviews are optional; this measures participation, not service quality. Written
                comment publication is tracked separately.
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" />
                  Storage usage
                </div>
                <Badge variant="outline">
                  <LockKeyhole className="mr-1 h-3 w-3" aria-hidden="true" />
                  Private
                </Badge>
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {formatStoragePercent(derived.storagePercent)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatStorageSize(derived.storageUsedBytes)} used of{" "}
                {formatStorageSize(derived.storageLimitBytes)}. This operational capacity is not
                shown to customers.
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Video className="h-4 w-4 text-primary" aria-hidden="true" />
                  Service Video pipeline
                </div>
                <Badge variant="outline">Customer signal</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={derived.pendingServiceOrders > 0 ? "warning" : "secondary"}>
                  {derived.pendingServiceOrders} pending Reliance Audit
                </Badge>
                <Badge variant="success">{derived.approvedServiceOrders} approved Private Service Records</Badge>
                <Badge variant="outline">{derived.publicServiceOrders} shared publicly</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Counts complete three-stage Service Orders, not individual video files. Public
                sharing remains separate from Private Service Record approval.
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Archive className="h-4 w-4 text-primary" aria-hidden="true" />
                  Work Record status
                </div>
                <Badge variant="outline">
                  <LockKeyhole className="mr-1 h-3 w-3" aria-hidden="true" />
                  Private
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{derived.scheduledJobs} scheduled</Badge>
                <Badge variant="secondary">{derived.inProgressJobs} in progress</Badge>
                <Badge variant="warning">{derived.awaitingReviewJobs} awaiting review</Badge>
                <Badge variant="success">{derived.completedJobs} completed</Badge>
                <Badge variant="outline">{derived.canceledJobs} canceled</Badge>
                <Badge variant="outline">{derived.rejectedJobs} rejected</Badge>
                <Badge variant="outline">{derived.archivedJobs} archived</Badge>
                {derived.unclassifiedJobs > 0 ? (
                  <Badge variant="destructive">{derived.unclassifiedJobs} needs classification</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {derived.statusCountMatchesTotal
                  ? `${derived.statusTotal} of ${derived.totalBookings} Work Records are represented by mutually exclusive current statuses.`
                  : `Status totals currently account for ${derived.statusTotal} of ${derived.totalBookings} Work Records. Refresh analytics; if the mismatch remains, the lifecycle data needs review.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer trust highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {derived.topPerformer ? (
              <div className="rounded-lg border bg-blue-50/90 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                  <Medal className="h-4 w-4" aria-hidden="true" />
                  Highest current employee rating
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {derived.topPerformer.displayName}
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDecimal(Number(derived.topPerformer.averageRating || 0))}★ average across{" "}
                  {Number(derived.topPerformer.reviewCount || 0)} verified employee rating
                  {Number(derived.topPerformer.reviewCount || 0) === 1 ? "" : "s"}.
                </p>
                <p className="mt-2 text-xs text-blue-900/80">
                  The sample size is shown so a single rating is not presented as a long-term trend.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No verified customer star rating has been attributed to a team member yet. This
                highlight will appear after a customer rates the assigned employee on a completed
                Service Order.
              </div>
            )}

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-slate-900">Most recent public review</p>
              {derived.mostRecentPublicReview ? (
                <>
                  <p
                    className="mt-2 text-sm font-medium text-amber-700"
                    aria-label={`${formatDecimal(derived.mostRecentPublicReview.rating)} out of 5 stars`}
                  >
                    {formatDecimal(derived.mostRecentPublicReview.rating)}★
                  </p>
                  <blockquote className="mt-2 text-sm text-slate-700">
                    “{derived.mostRecentPublicReview.comment}”
                  </blockquote>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {derived.mostRecentPublicReview.client || "Customer"} ·{" "}
                    {derived.mostRecentPublicReview.jobType || "Service"} ·{" "}
                    {formatDate(derived.mostRecentPublicReview.date)}
                  </p>
                </>
              ) : Number(data.stats.publicWrittenReviewCount || 0) > 0 ? (
                <p className="mt-2 text-sm text-amber-800">
                  Public review details are temporarily unavailable. Refresh analytics or open the
                  Reviews page to try again.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No public reviews are available yet for this vendor.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/vendor/dashboard">Back to Dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/vendor/reviews">Open Reviews</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/vendor/media">Open Video Library</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
