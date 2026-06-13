'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { RefreshCw, ShieldAlert } from 'lucide-react';

type ReviewQueueRow = {
  reviewId: string;
  vendorId: string;
  vendorName: string | null;
  userId: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  clientName: string | null;
  jobType: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  moderationStatus: string;
  visibilityStatus: string;
  moderationReason: string | null;
  moderatedAt: string | null;
  aiRecommendation?: {
    aiRunId: string;
    promptVersion: string;
    model: string;
    suggestion: {
      summary: string;
      decision:
        | 'approve_public'
        | 'approve_vendor_private'
        | 'flag'
        | 'reject'
        | 'needs_manual_review';
      confidence: 'low' | 'medium' | 'high';
      blockingIssues: string[];
      recommendedActions: string[];
      customerTrustNote: string;
      suggestedModerationReason: string | null;
    };
  } | null;
};

function formatReviewerEmail(email: string | null | undefined) {
  const normalized = String(email || '').trim();
  if (!normalized || /@reliance\.test$/i.test(normalized)) return null;
  return normalized;
}

function prettyStatus(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'pending_review') return 'Pending Review';
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function reviewVisibilityLabel(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'public') return 'Public';
  if (normalized === 'private') return 'Private';
  return prettyStatus(normalized);
}

type ReviewModerationAction =
  | 'approve_public'
  | 'approve_vendor_private'
  | 'reject'
  | 'flag';

function ReviewsPageContent() {
  const searchParams = useSearchParams();
  const [reviews, setReviews] = useState<ReviewQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewQueueRow | null>(null);
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState<string | null>(null);
  const [aiLoadingReviewId, setAiLoadingReviewId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [moderationNoteModalOpen, setModerationNoteModalOpen] = useState(false);
  const [moderationNoteReason, setModerationNoteReason] = useState('');
  const [moderationNoteTarget, setModerationNoteTarget] = useState<ReviewQueueRow | null>(null);
  const [moderationNoteAction, setModerationNoteAction] = useState<'reject' | 'flag' | null>(null);

  const fetchQueue = async (
    nextPage = page,
    nextLimit = limit,
    overrides?: Partial<{
      moderationStatus: string;
      visibilityStatus: string;
      vendorId: string;
      date: string;
      search: string;
    }>
  ) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      const moderationStatus = overrides?.moderationStatus ?? statusFilter;
      const visibilityStatus = overrides?.visibilityStatus ?? visibilityFilter;
      const resolvedVendorId = overrides?.vendorId ?? vendorFilter;
      const resolvedDate = overrides?.date ?? dateFilter;
      const resolvedSearch = overrides?.search ?? search;
      if (moderationStatus !== 'all') params.set('moderationStatus', moderationStatus);
      if (visibilityStatus !== 'all') params.set('visibilityStatus', visibilityStatus);
      if (resolvedVendorId !== 'all') params.set('vendorId', resolvedVendorId);
      if (resolvedDate) params.set('date', resolvedDate);
      if (resolvedSearch.trim()) params.set('q', resolvedSearch.trim());
      params.set('page', String(nextPage));
      params.set('limit', String(nextLimit));

      const res = await fetch(`/api/admin/reviews/moderation-queue?${params.toString()}`, {
        method: 'GET',
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);
      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      setTotalPages(Number(json?.pagination?.totalPages || 0));
      setTotalCount(Number(json?.pagination?.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review moderation queue');
      setReviews([]);
      setTotalPages(0);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const routeSearch = String(searchParams?.get('q') || '').trim();
    setSearch((current) => (current === routeSearch ? current : routeSearch));
    setPage(1);
    fetchQueue(1, limit, { search: routeSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, limit]);

  const applyModerationAction = async (
    review: ReviewQueueRow,
    action: ReviewModerationAction,
    moderationReason?: string
  ) => {
    setReviewActionLoadingId(`${review.reviewId}:${action}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/reviews/${review.reviewId}/moderate`, {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action,
          moderationReason: moderationReason || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      const updated = json.review as Partial<ReviewQueueRow> | undefined;
      if (updated) {
        setReviews((prev) =>
          prev.map((row) =>
            row.reviewId === review.reviewId
              ? {
                  ...row,
                  moderationStatus: String(updated.moderationStatus || row.moderationStatus),
                  visibilityStatus: String(updated.visibilityStatus || row.visibilityStatus),
                  moderationReason:
                    updated.moderationReason !== undefined ? (updated.moderationReason as string | null) : row.moderationReason,
                  moderatedAt: (updated.moderatedAt as string | null) ?? row.moderatedAt,
                }
              : row
          )
        );

        setSelectedReview((prev) =>
          prev && prev.reviewId === review.reviewId
            ? {
                ...prev,
                moderationStatus: String(updated.moderationStatus || prev.moderationStatus),
                visibilityStatus: String(updated.visibilityStatus || prev.visibilityStatus),
                moderationReason:
                  updated.moderationReason !== undefined ? (updated.moderationReason as string | null) : prev.moderationReason,
                moderatedAt: (updated.moderatedAt as string | null) ?? prev.moderatedAt,
              }
            : prev
        );
      }

      setFeedback({
        type: 'success',
        message: json?.message || 'Review moderation action applied successfully',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to apply review moderation action',
      });
    } finally {
      setReviewActionLoadingId(null);
    }
  };

  const requestAiReview = async (review: ReviewQueueRow) => {
    setAiLoadingReviewId(review.reviewId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/reviews/${review.reviewId}/assist`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Status ${res.status}`);
      }

      setReviews((current) =>
        current.map((row) =>
          row.reviewId === review.reviewId
            ? {
                ...row,
                aiRecommendation: {
                  aiRunId: String(json?.aiRunId || json?.responseId || ''),
                  promptVersion: String(json?.promptVersion || ''),
                  model: String(json?.model || ''),
                  suggestion: json?.suggestion,
                },
              }
            : row
        )
      );

      setSelectedReview((current) =>
        current && current.reviewId === review.reviewId
          ? {
              ...current,
              aiRecommendation: {
                aiRunId: String(json?.aiRunId || json?.responseId || ''),
                promptVersion: String(json?.promptVersion || ''),
                model: String(json?.model || ''),
                suggestion: json?.suggestion,
              },
            }
          : current
      );

      setFeedback({
        type: 'success',
        message: json?.message || 'AI review moderation recommendation generated',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message:
          e instanceof Error
            ? e.message
            : 'Failed to generate AI review moderation recommendation',
      });
    } finally {
      setAiLoadingReviewId(null);
    }
  };

  const prettyAiDecision = (
    value:
      | 'approve_public'
      | 'approve_vendor_private'
      | 'flag'
      | 'reject'
      | 'needs_manual_review'
  ) =>
    value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const aiDecisionClass = (
    value:
      | 'approve_public'
      | 'approve_vendor_private'
      | 'flag'
      | 'reject'
      | 'needs_manual_review'
  ) => {
    if (value === 'reject' || value === 'flag') {
      return 'border-red-200 bg-red-50 text-red-700';
    }
    if (value === 'approve_vendor_private' || value === 'needs_manual_review') {
      return 'border-amber-200 bg-amber-50 text-amber-800';
    }
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  };

  const vendors = useMemo(
    () => Array.from(new Set(reviews.map((r) => `${r.vendorId}::${r.vendorName || r.vendorId}`))),
    [reviews]
  );

  const summary = useMemo(() => {
    const pending = reviews.filter((review) => String(review.moderationStatus).toLowerCase() === 'pending_review').length;
    const approvedPublic = reviews.filter(
      (review) =>
        String(review.moderationStatus).toLowerCase() === 'approved' &&
        String(review.visibilityStatus).toLowerCase() === 'public'
    ).length;
    const approvedPrivate = reviews.filter(
      (review) =>
        String(review.moderationStatus).toLowerCase() === 'approved' &&
        String(review.visibilityStatus).toLowerCase() === 'private'
    ).length;
    const flaggedOrRejected = reviews.filter((review) => {
      const status = String(review.moderationStatus).toLowerCase();
      return status === 'flagged' || status === 'rejected';
    }).length;
    return { pending, approvedPublic, approvedPrivate, flaggedOrRejected };
  }, [reviews]);

  const openModerationNoteModal = (review: ReviewQueueRow, action: 'reject' | 'flag') => {
    setModerationNoteTarget(review);
    setModerationNoteAction(action);
    setModerationNoteReason('');
    setModerationNoteModalOpen(true);
  };

  const closeModerationNoteModal = () => {
    setModerationNoteModalOpen(false);
    setModerationNoteTarget(null);
    setModerationNoteAction(null);
    setModerationNoteReason('');
  };

  const submitModerationNote = async () => {
    if (!moderationNoteTarget || !moderationNoteAction || !moderationNoteReason.trim()) return;
    await applyModerationAction(moderationNoteTarget, moderationNoteAction, moderationNoteReason.trim());
    closeModerationNoteModal();
  };

  const queueEmpty = !loading && !error && reviews.length === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Moderation</h1>
          <p className="text-gray-600 mt-1">Review customer feedback, choose visibility, and keep launch-facing reviews trustworthy.</p>
        </div>
        <Button variant="outline" onClick={() => fetchQueue(page, limit)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending Review</div>
              <div className="mt-2 text-2xl font-bold text-amber-900">{summary.pending}</div>
              <p className="mt-1 text-sm text-amber-800">Needs an admin visibility decision.</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved Public</div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{summary.approvedPublic}</div>
              <p className="mt-1 text-sm text-emerald-800">Visible on public vendor and service pages.</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Approved Private</div>
              <div className="mt-2 text-2xl font-bold text-blue-900">{summary.approvedPrivate}</div>
              <p className="mt-1 text-sm text-blue-800">Kept out of public discovery while still retained.</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Flagged Or Rejected</div>
              <div className="mt-2 text-2xl font-bold text-rose-900">{summary.flaggedOrRejected}</div>
              <p className="mt-1 text-sm text-rose-800">Reviews that need follow-up or were not approved.</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Operator flow</div>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
              <p>1. Check the rating, comment, vendor, and reviewer details.</p>
              <p>2. Choose whether the review should be public, private, rejected, or flagged.</p>
              <p>3. Record a clear reason when you reject or escalate a review.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link
                href="/admin/review-audit"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Open Review Audit
              </Link>
              <Link
                href="/admin/activity?aiFeature=dispute_summary_assistant"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Open AI Activity Monitoring
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {feedback && (
        <div
          className={`p-3 rounded border text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Queue Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Input
            placeholder="Search by review id, reviewer, comment, or vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All moderation statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
          </select>
          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All visibility states</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All vendors</option>
            {vendors.map((v) => {
              const [id, name] = v.split('::');
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setPage(1);
                fetchQueue(1, limit);
              }}
              disabled={loading}
            >
              Apply
            </Button>
            <select
              value={String(limit)}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLimit(next);
                setPage(1);
                fetchQueue(1, next);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading review moderation queue...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
        </Card>
      ) : queueEmpty ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No reviews in queue for the selected filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardContent className="py-3 text-sm text-gray-600">
              Showing {reviews.length} of {totalCount} total reviews matching the current filters.
            </CardContent>
          </Card>
          {reviews.map((review) => {
            const actionBusy = Boolean(reviewActionLoadingId?.startsWith(`${review.reviewId}:`));
            return (
              <Card key={review.reviewId}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div className="lg:col-span-7 space-y-1 text-sm">
                      <div className="font-semibold text-base">
                        Review #{review.reviewId}
                      </div>
                      {String(review.moderationStatus).toLowerCase() === 'pending_review' ? (
                        <div className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                          Awaiting admin decision
                        </div>
                      ) : null}
                      <div>Vendor: {review.vendorName || review.vendorId}</div>
                      <div>
                        Reviewer: {review.reviewerName || review.userId}
                        {(() => {
                          const reviewerEmail = formatReviewerEmail(review.reviewerEmail);
                          return reviewerEmail ? ` • ${reviewerEmail}` : '';
                        })()}
                      </div>
                      <div>Rating: {review.rating}/5</div>
                      {review.jobType ? <div>Job Type: {review.jobType}</div> : null}
                      <div className="text-gray-700">Comment: {review.comment || '-'}</div>
                      <div>Created: {new Date(review.createdAt).toLocaleString()}</div>
                      {review.moderatedAt ? <div>Moderated: {new Date(review.moderatedAt).toLocaleString()}</div> : null}
                    </div>
                  <div className="lg:col-span-2 space-y-2">
                      <Badge className="block w-fit">{prettyStatus(review.moderationStatus)}</Badge>
                      <Badge variant="outline" className="block w-fit">
                        {reviewVisibilityLabel(review.visibilityStatus)}
                      </Badge>
                      {review.moderationReason ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          Reason: {review.moderationReason}
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={aiLoadingReviewId === review.reviewId}
                        onClick={() => requestAiReview(review)}
                      >
                        {aiLoadingReviewId === review.reviewId
                          ? 'Checking...'
                          : review.aiRecommendation
                            ? 'Refresh AI Review'
                            : 'Run AI Review'}
                      </Button>
                    </div>
                    <div className="lg:col-span-3 flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedReview(review)}>
                        Details
                      </Button>
                      <Button size="sm" disabled={actionBusy} onClick={() => applyModerationAction(review, 'approve_public')}>
                        Approve Public
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionBusy}
                        onClick={() => applyModerationAction(review, 'approve_vendor_private')}
                      >
                        Keep Private
                      </Button>
                      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => openModerationNoteModal(review, 'reject')}>
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => openModerationNoteModal(review, 'flag')}>
                        <ShieldAlert className="w-4 h-4 mr-1" />
                        Flag
                      </Button>
                    </div>
                  </div>
                  {review.aiRecommendation ? (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={aiDecisionClass(review.aiRecommendation.suggestion.decision)}
                        >
                          {prettyAiDecision(review.aiRecommendation.suggestion.decision)}
                        </Badge>
                        <Badge variant="outline">
                          {review.aiRecommendation.suggestion.confidence} confidence
                        </Badge>
                      </div>
                      <p className="mt-3 text-slate-800">
                        {review.aiRecommendation.suggestion.summary}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        Customer trust note: {review.aiRecommendation.suggestion.customerTrustNote}
                      </p>
                      {review.aiRecommendation.suggestion.blockingIssues.length > 0 ? (
                        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                          <div className="font-semibold uppercase tracking-wide text-red-700">
                            Risk signals
                          </div>
                          <ul className="mt-2 space-y-1">
                            {review.aiRecommendation.suggestion.blockingIssues
                              .slice(0, 3)
                              .map((item) => (
                                <li key={item}>- {item}</li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                      {review.aiRecommendation.suggestion.recommendedActions.length > 0 ? (
                        <div className="mt-3 rounded-md border border-blue-200 bg-white p-3 text-xs text-slate-700">
                          <div className="font-semibold uppercase tracking-wide text-slate-700">
                            Suggested next action
                          </div>
                          <ul className="mt-2 space-y-1">
                            {review.aiRecommendation.suggestion.recommendedActions
                              .slice(0, 3)
                              .map((item) => (
                                <li key={item}>- {item}</li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  fetchQueue(next, limit);
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  fetchQueue(next, limit);
                }}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(selectedReview)} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>Moderation context for selected review.</DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>Review ID: {selectedReview.reviewId}</div>
                <div>Vendor ID: {selectedReview.vendorId}</div>
                <div>Vendor: {selectedReview.vendorName || '-'}</div>
                <div>User ID: {selectedReview.userId}</div>
                <div>Reviewer: {selectedReview.reviewerName || '-'}</div>
                <div>Email: {formatReviewerEmail(selectedReview.reviewerEmail) || '-'}</div>
                <div>Rating: {selectedReview.rating}/5</div>
                <div>Created: {new Date(selectedReview.createdAt).toLocaleString()}</div>
                <div>Moderation: {prettyStatus(selectedReview.moderationStatus)}</div>
                <div>Visibility: {reviewVisibilityLabel(selectedReview.visibilityStatus)}</div>
              </div>
              <div className="rounded border p-3 bg-gray-50">
                <p className="font-medium mb-1">Comment</p>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedReview.comment || '-'}</p>
              </div>
              {selectedReview.moderationReason ? (
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  Moderation reason: {selectedReview.moderationReason}
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moderationNoteModalOpen} onOpenChange={(open) => !open && closeModerationNoteModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderationNoteAction === 'flag' ? 'Flag Review' : 'Reject Review'}</DialogTitle>
            <DialogDescription>
              {moderationNoteAction === 'flag'
                ? 'Provide moderation reason to flag this review for follow-up.'
                : 'Provide moderation reason to reject this review.'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={moderationNoteReason}
            onChange={(e) => setModerationNoteReason(e.target.value)}
            placeholder={moderationNoteAction === 'flag' ? 'Enter flag reason...' : 'Enter rejection reason...'}
            className="w-full min-h-[120px] rounded border border-input px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeModerationNoteModal}>
              Cancel
            </Button>
            <Button onClick={submitModerationNote} disabled={!moderationNoteReason.trim() || Boolean(reviewActionLoadingId)}>
              {moderationNoteAction === 'flag' ? 'Submit Flag' : 'Submit Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewsPageFallback() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          Loading review moderation queue...
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<ReviewsPageFallback />}>
      <ReviewsPageContent />
    </Suspense>
  );
}
