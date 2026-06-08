"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BarChart3,
  CalendarDays,
  HardDrive,
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

function formatStorageSize(bytesString: string | undefined) {
  const bytes = Number(bytesString || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VendorAnalyticsPage() {
  const { data, loading, error, refetch, approvalPending } = useVendorDashboard();

  const derived = useMemo(() => {
    if (!data) return null;

    const totalBookings = Number(data.stats?.totalBookings || 0);
    const totalClients = Number(data.stats?.totalClients || 0);
    const rating = Number(data.stats?.rating || 0);
    const ratingCount = Number(data.stats?.ratingCount || 0);
    const approvedVideos = Number(data.approvedProofs || 0);
    const pendingVideos = Number(data.pendingModerationProofs || 0);
    const archivedVideos = Number(data.archivedProofs || 0);
    const totalProofAssets = Number(data.totalProofAssets || 0);
    const storagePercent = Number(data.storagePercentUsed || 0);

    const completedJobs = data.recentJobs.filter((job) => job.status === "completed").length;
    const inProgressJobs = data.recentJobs.filter((job) => job.status === "in progress").length;
    const scheduledJobs = data.recentJobs.filter((job) => job.status === "scheduled").length;
    const completionRate =
      totalBookings > 0 ? Math.round((completedJobs / totalBookings) * 100) : 0;
    const reviewCoverage =
      completedJobs > 0 ? Math.round((data.recentReviews.length / completedJobs) * 100) : 0;

    const topPerformer =
      [...(data.employeePerformance || [])]
        .filter((row) => Number(row.reviewCount || 0) > 0)
        .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0))[0] || null;

    return {
      totalBookings,
      totalClients,
      rating,
      ratingCount,
      approvedVideos,
      pendingVideos,
      archivedVideos,
      totalProofAssets,
      storagePercent,
      completedJobs,
      inProgressJobs,
      scheduledJobs,
      completionRate,
      reviewCoverage,
      topPerformer,
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
      <div className="space-y-8 px-4 py-8 md:px-8">
        <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
          <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
            Customer confidence
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
            See which signals help customers trust and choose your business
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
            Loading the trust, review, service video, and business-performance signals that shape how
            customers experience your public profile.
          </p>
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
      label: "Total bookings",
      value: String(derived.totalBookings),
      helper: `${derived.totalClients} distinct clients`,
      icon: CalendarDays,
    },
    {
      label: "Completion rate",
      value: formatPercent(derived.completionRate),
      helper: `${derived.completedJobs} completed from recent tracked jobs`,
      icon: TrendingUp,
    },
    {
      label: "Customer rating",
      value: `${formatDecimal(derived.rating)}★`,
      helper: `${derived.ratingCount} public approved reviews`,
      icon: Star,
    },
    {
      label: "Service video approvals",
      value: String(derived.approvedVideos),
      helper: `${derived.pendingVideos} pending moderation`,
      icon: Video,
    },
  ];

  return (
    <div className="space-y-8 px-4 py-8 md:px-8">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Customer confidence
        </div>
        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
              Understand what makes customers trust and book your business
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              Review the public trust signals, approved service videos, review strength, and
              completed-work patterns that shape customer confidence in {data.profile.businessName || "your business"}.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/45 px-5 py-4 shadow-[0_18px_55px_rgba(4,10,22,0.24)]">
            <div className="rounded-full bg-blue-50/90 p-3 text-blue-700">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.28em] text-white/46">
                Important distinction
              </p>
              <p className="text-sm font-medium text-white/82">
                Customer Reviews and Reliance Trust Score help confidence in different ways.
              </p>
            </div>
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

      <VendorTrustScoreCard dashboardData={data} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <Card>
          <CardHeader>
            <CardTitle>What customers can feel from your recent activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50/90 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Review coverage
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatPercent(derived.reviewCoverage)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                This shows how much completed work is already turning into public customer proof.
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-50/90 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <HardDrive className="h-4 w-4 text-primary" />
                Storage usage
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatPercent(derived.storagePercent)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatStorageSize(data.storageUsedBytes)} used of {formatStorageSize(data.storageLimitBytes)}.
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-50/90 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Video className="h-4 w-4 text-primary" />
                Service video pipeline
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={derived.pendingVideos > 0 ? "warning" : "secondary"}>
                  {derived.pendingVideos} pending
                </Badge>
                <Badge variant="success">{derived.approvedVideos} approved</Badge>
                <Badge variant="outline">{derived.archivedVideos} archived</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Approved service videos help first-time customers trust what your business actually delivers.
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-50/90 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Job status mix
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{derived.scheduledJobs} scheduled</Badge>
                <Badge variant="secondary">{derived.inProgressJobs} in progress</Badge>
                <Badge variant="success">{derived.completedJobs} completed</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Consistent completion keeps future reviews, service videos, and trust signals moving.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public proof highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {derived.topPerformer ? (
              <div className="rounded-2xl border bg-blue-50/90 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                  <Medal className="h-4 w-4" />
                  Strongest rated team member
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {derived.topPerformer.displayName}
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDecimal(Number(derived.topPerformer.averageRating || 0))}★ average across{" "}
                  {Number(derived.topPerformer.reviewCount || 0)} attributed reviews.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                No employee attribution trend is measurable yet. Team highlights will appear after more
                approved customer reviews are tied to completed jobs.
              </div>
            )}

            <div className="rounded-2xl border p-4">
              <p className="text-sm font-medium text-slate-900">Most recent public review</p>
              {data.recentReviews.length > 0 ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    "{data.recentReviews[0]?.comment || "No comment provided."}"
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.recentReviews[0]?.client || "Customer"} •{" "}
                    {formatDate(data.recentReviews[0]?.date)}
                  </p>
                </>
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
