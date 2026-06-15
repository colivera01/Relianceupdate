"use client";

import Link from "next/link";
import { LockKeyhole, MessageSquare, RefreshCcw, ShieldCheck, Star, Users } from "lucide-react";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderStars(rating: number) {
  return [...Array(5)].map((_, index) => (
    <Star
      key={`${rating}-${index}`}
      className={`h-4 w-4 ${index < rating ? "fill-current text-amber-500" : "text-gray-300"}`}
    />
  ));
}

function formatRating(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function VendorReviewsPage() {
  const { data, loading, error, refetch, approvalPending } = useVendorDashboard();

  if (approvalPending) {
    return (
      <div className="px-4 py-8 md:px-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Vendor approval is still pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>
              Customer reviews will appear here once your vendor account is approved and your dashboard is available.
            </p>
            <Button asChild variant="outline">
              <Link href="/vendor/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-8 md:px-8">
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading published customer reviews...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Reviews are temporarily unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-red-900">
            <p>{error || "We could not load your published review summary right now."}</p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={refetch}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link href="/vendor/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rating = Number(data.stats.rating || 0);
  const reviewCount = Number(data.stats.ratingCount || data.recentReviews.length || 0);
  const latestReview = data.recentReviews[0] || null;
  const teamRows = [...(data.employeePerformance || [])].sort((a, b) => {
    const bCount = Number(b.reviewCount || 0);
    const aCount = Number(a.reviewCount || 0);
    if (bCount !== aCount) return bCount - aCount;
    return Number(b.averageRating || 0) - Number(a.averageRating || 0);
  });
  const attributedTeamReviewCount = teamRows.reduce((sum, row) => sum + Number(row.reviewCount || 0), 0);

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-blue-400/20 bg-slate-950 text-white shadow-[0_24px_80px_rgba(3,10,27,0.28)]">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-500/15 p-3 text-blue-200">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-white">Reviews & Team Reputation</h1>
                  <p className="text-sm text-blue-100">
                    Separate what customers see publicly from private team-member performance.
                  </p>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                Public reviews shape the business reputation customers see. Team performance is private
                and only uses reviews Reliance can attribute to a specific assigned team member. Reliance
                Trust Score remains separate from customer star ratings.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/vendor/dashboard">Back to Dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/vendor/jobs?filter=completed">View Completed Jobs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-700 bg-slate-950/75 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Public Business Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{formatRating(rating)}</p>
              <div className="mt-2 flex items-center gap-1">{renderStars(Math.round(rating))}</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This is the customer-facing business average.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-950/75 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Published Public Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{reviewCount}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Approved customer reviews currently visible to customers.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-950/75 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LockKeyhole className="h-4 w-4 text-blue-200" />
                Private Team Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{attributedTeamReviewCount}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Reviews attributed to assigned team members. Not shown publicly.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-950/75 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Trust Score Separation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Separate system
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Trust Score is based on verified operational activity, not customer star ratings.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-blue-400/20 bg-blue-950/25 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-200" />
              Private Team Performance
            </CardTitle>
            <p className="text-sm leading-6 text-slate-300">
              This section helps a business owner coach the team without making employee ratings public.
              A customer complaint about scheduling, pricing, or management should remain business feedback
              unless it is clearly tied to the assigned worker or crew.
            </p>
          </CardHeader>
          <CardContent>
            {teamRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-blue-300/25 bg-slate-950/45 p-6 text-sm text-slate-300">
                Team performance appears after completed service records receive approved reviews that
                Reliance can attribute to assigned team members.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[1.5fr,0.8fr,1fr] gap-3 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                  <span>Team member</span>
                  <span>Private rating</span>
                  <span>Attributed reviews</span>
                </div>
                {teamRows.map((row) => {
                  const rowRating = Number(row.averageRating || 0);
                  const rowCount = Number(row.reviewCount || 0);
                  return (
                    <div
                      key={row.membershipId}
                      className="grid grid-cols-[1.5fr,0.8fr,1fr] gap-3 border-b border-white/10 px-4 py-4 text-sm text-slate-200 last:border-b-0"
                    >
                      <div>
                        <p className="font-semibold text-white">{row.displayName || "Team member"}</p>
                        <p className="mt-1 text-xs text-slate-400">Private manager-facing view</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{formatRating(rowRating)}</p>
                        <div className="mt-1 flex items-center gap-1">{renderStars(Math.round(rowRating))}</div>
                      </div>
                      <p className="text-slate-300">{pluralize(rowCount, "review")}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Published Reviews</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                These are the customer reviews currently shaping how new customers judge your business.
              </p>
            </div>
            {latestReview ? (
              <p className="text-sm text-gray-500">Latest approved review: {formatReviewDate(latestReview.date)}</p>
            ) : null}
          </CardHeader>
          <CardContent>
            {data.recentReviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
                <p className="font-medium text-gray-700">No published reviews yet.</p>
                <p className="mt-2 text-sm">
                  Customer feedback appears here after a completed job, review submission, and Reliance
                  admin approval. Published reviews are one of the clearest public trust signals for new customers.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentReviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{review.client}</p>
                        <p className="text-sm text-gray-500">{review.jobType || "Service"}</p>
                      </div>
                      <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-700">{review.comment}</p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Approved feedback · {formatReviewDate(review.date)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
