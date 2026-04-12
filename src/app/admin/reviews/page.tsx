'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
};

type ReviewModerationAction =
  | 'approve_public'
  | 'approve_vendor_private'
  | 'reject'
  | 'flag';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewQueueRow | null>(null);
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<ReviewQueueRow | null>(null);

  const adminHeaders = () => {
    const user = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const userId = user?.id || 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0';
    return {
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
      'x-user-role': 'admin',
      'x-admin': 'true',
    };
  };

  const fetchQueue = async (nextPage = page, nextLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('moderationStatus', statusFilter);
      if (visibilityFilter !== 'all') params.set('visibilityStatus', visibilityFilter);
      if (vendorFilter !== 'all') params.set('vendorId', vendorFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (search.trim()) params.set('q', search.trim());
      params.set('page', String(nextPage));
      params.set('limit', String(nextLimit));

      const res = await fetch(`/api/admin/reviews/moderation-queue?${params.toString()}`, {
        method: 'GET',
        headers: adminHeaders(),
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
    fetchQueue(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        headers: adminHeaders(),
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

  const vendors = useMemo(
    () => Array.from(new Set(reviews.map((r) => `${r.vendorId}::${r.vendorName || r.vendorId}`))),
    [reviews]
  );

  const openRejectModal = (review: ReviewQueueRow) => {
    setRejectTarget(review);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await applyModerationAction(rejectTarget, 'reject', rejectReason.trim());
    setRejectModalOpen(false);
    setRejectTarget(null);
    setRejectReason('');
  };

  const queueEmpty = !loading && !error && reviews.length === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Moderation</h1>
          <p className="text-gray-600 mt-1">Review customer feedback and apply public visibility decisions.</p>
        </div>
        <Button variant="outline" onClick={() => fetchQueue(page, limit)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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
          <CardTitle>Filters</CardTitle>
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
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="flagged">flagged</option>
          </select>
          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All visibility states</option>
            <option value="public">public</option>
            <option value="private">private</option>
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
              Showing {reviews.length} of {totalCount} total reviews.
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
                      <div>Vendor: {review.vendorName || review.vendorId}</div>
                      <div>Reviewer: {review.reviewerName || review.userId}{review.reviewerEmail ? ` • ${review.reviewerEmail}` : ''}</div>
                      <div>Rating: {review.rating}/5</div>
                      {review.jobType ? <div>Job Type: {review.jobType}</div> : null}
                      <div className="text-gray-700">Comment: {review.comment || '-'}</div>
                      <div>Created: {new Date(review.createdAt).toLocaleString()}</div>
                      {review.moderatedAt ? <div>Moderated: {new Date(review.moderatedAt).toLocaleString()}</div> : null}
                    </div>
                    <div className="lg:col-span-2 space-y-2">
                      <Badge className="block w-fit">{review.moderationStatus}</Badge>
                      <Badge variant="outline" className="block w-fit">
                        {review.visibilityStatus}
                      </Badge>
                      {review.moderationReason ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          Reason: {review.moderationReason}
                        </p>
                      ) : null}
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
                      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => openRejectModal(review)}>
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => applyModerationAction(review, 'flag')}>
                        <ShieldAlert className="w-4 h-4 mr-1" />
                        Flag
                      </Button>
                    </div>
                  </div>
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
                <div>Email: {selectedReview.reviewerEmail || '-'}</div>
                <div>Rating: {selectedReview.rating}/5</div>
                <div>Created: {new Date(selectedReview.createdAt).toLocaleString()}</div>
                <div>Moderation: {selectedReview.moderationStatus}</div>
                <div>Visibility: {selectedReview.visibilityStatus}</div>
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

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Review</DialogTitle>
            <DialogDescription>Provide moderation reason to reject this review.</DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full min-h-[120px] rounded border border-input px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReject} disabled={!rejectReason.trim() || Boolean(reviewActionLoadingId)}>
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}