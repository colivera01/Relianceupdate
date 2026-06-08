"use client";

import Link from "next/link";
import { MessageSquare, RefreshCcw, ShieldCheck, Star } from "lucide-react";
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

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-3 text-blue-700">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-blue-950">Customer Reviews</h1>
                  <p className="text-sm text-blue-900">
                    Published feedback that customers can already see for {data.profile.businessName || "your business"}.
                  </p>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-blue-900">
                Published reviews help customers feel safer choosing your business. Reliance admin still
                approves whether a review becomes public, and this page shows the approved feedback that
                is already strengthening your credibility.
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

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Published Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{rating.toFixed(1)}</p>
              <div className="mt-2 flex items-center gap-1">{renderStars(Math.round(rating))}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Public Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{reviewCount}</p>
              <p className="mt-2 text-sm text-gray-600">
                Approved reviews currently improving customer confidence in your public reputation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Moderation Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Reliance admin approves public review visibility before feedback appears here.</p>
              </div>
              <p className="text-sm text-gray-600">
                New customer reviews show up here after approval. Keep completed jobs moving through the
                approved service-video workflow so more trustworthy customer feedback can publish.
              </p>
            </CardContent>
          </Card>
        </div>

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
