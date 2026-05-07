'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { getClientSessionHeaders } from '@/lib/client-session';

type PendingReviewItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  proofUrl: string | null;
};

type SubmittedReviewItem = {
  reviewId: string;
  bookingId: string | null;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  rating: number;
  comment: string;
  submittedAt: string;
  hasProof: boolean;
  proofUrl: string | null;
};

type ReviewsMeResponse = {
  pending: PendingReviewItem[];
  submitted: SubmittedReviewItem[];
  proofBased: SubmittedReviewItem[];
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function renderStars(rating: number) {
  const rounded = Math.max(0, Math.min(5, Number.isFinite(rating) ? Math.round(rating) : 0));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < rounded ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

function sectionEmptyState(message: string) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3 mb-3 text-sm text-gray-600">{message}</div>
  );
}

function sectionSkeletonRows() {
  return Array.from({ length: 3 }).map((_, index) => (
    <div key={`skeleton-${index}`} className="bg-white rounded-xl shadow-sm border p-3 mb-3 space-y-3">
        <div className="h-5 w-52 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-gray-100 animate-pulse" />
    </div>
  ));
}

export default function ReviewsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = resolveCustomerUserId(user?.id);

  const [data, setData] = useState<ReviewsMeResponse>({
    pending: [],
    submitted: [],
    proofBased: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError('Unauthorized. Sign in to view your reviews.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = getClientSessionHeaders(userId);
      const response = await fetch('/api/reviews/me', {
        method: 'GET',
        headers,
        cache: 'no-store',
        credentials: 'include',
      });
      const json = (await response.json().catch(() => ({}))) as Partial<ReviewsMeResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(String(json?.error || `Failed to load reviews (${response.status})`));
      }

      setData({
        pending: Array.isArray(json?.pending) ? json.pending : [],
        submitted: Array.isArray(json?.submitted) ? json.submitted : [],
        proofBased: Array.isArray(json?.proofBased) ? json.proofBased : [],
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load reviews');
      setData({
        pending: [],
        submitted: [],
        proofBased: [],
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void loadReviews();
  }, [authLoading, loadReviews]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-gray-900">My Reviews</h1>
            <p className="text-sm text-gray-600">Track what needs feedback and what you have submitted.</p>
            <p className="text-sm text-gray-600">
              You have: {data.pending.length} Pending Reviews - {data.submitted.length} Submitted Reviews
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadReviews()} disabled={loading || authLoading}>
            Refresh
          </Button>
        </div>

        {loading || authLoading ? (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900">Loading your reviews...</h2>
            {sectionSkeletonRows()}
          </section>
        ) : null}

        {error ? (
          <div className="bg-white rounded-xl shadow-sm border p-3 mb-10 space-y-3">
            <p className="text-sm text-red-700">We couldn't load your reviews.</p>
            <Button type="button" variant="outline" onClick={() => void loadReviews()}>
              Retry
            </Button>
          </div>
        ) : null}

        {!loading && !authLoading && !error ? (
          <>
            <section className="mb-10">
              <div className="space-y-1 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Pending Reviews</h2>
                <p className="text-sm text-gray-600">Complete these first.</p>
              </div>
              {data.pending.length === 0
                ? sectionEmptyState('You have no reviews to complete')
                : data.pending.map((item) => (
                    <div key={item.bookingId} className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-300 p-3 mb-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          <p className="text-sm text-gray-500">Date: {formatDate(item.serviceDate)}</p>
                        </div>
                        <Link href={`/my-bookings/${item.bookingId}`}>
                          <Button size="default" className="bg-yellow-500 text-white hover:bg-yellow-600">
                            ⭐ Leave Review
                          </Button>
                        </Link>
                    </div>
                  ))}
            </section>

            <section className="mb-10">
              <div className="space-y-1 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Submitted Reviews</h2>
                <p className="text-sm text-gray-600">Your completed feedback.</p>
              </div>
              {data.submitted.length === 0
                ? sectionEmptyState('No reviews yet — your feedback will appear here')
                : data.submitted.map((item) => (
                    <div key={item.reviewId} className="bg-white rounded-xl shadow-sm border p-3 mb-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2.5">
                          <p className="text-lg font-semibold text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          {renderStars(item.rating)}
                          <p className="text-sm text-gray-600 leading-6 line-clamp-2">{item.comment || 'No written comment.'}</p>
                          <p className="text-sm text-gray-500">Date: {formatDate(item.submittedAt)}</p>
                        </div>
                        {item.bookingId && (item.proofUrl || item.hasProof) ? (
                          <Link href={`/my-bookings/${item.bookingId}`}>
                            <Button variant="outline">View Proof</Button>
                          </Link>
                        ) : null}
                    </div>
                  ))}
            </section>

            <section className="mb-10">
              <div className="space-y-1 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Proof-Based Reviews</h2>
                <p className="text-sm text-gray-600">Trusted reviews tied to service proof.</p>
              </div>
              {data.proofBased.length === 0
                ? sectionEmptyState('No proof-based reviews yet.')
                : data.proofBased.map((item) => (
                    <div key={`proof-${item.reviewId}`} className="bg-green-50 rounded-xl shadow-sm border border-green-300 p-3 mb-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2.5">
                          <p className="text-xs text-green-700 font-medium">✔ Verified with Proof</p>
                          <p className="text-lg font-semibold text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          {renderStars(item.rating)}
                          <p className="text-sm text-gray-700 leading-6 line-clamp-2">{item.comment || 'No written comment.'}</p>
                          <p className="text-sm text-gray-500">Date: {formatDate(item.submittedAt)}</p>
                        </div>
                        {item.bookingId ? (
                          <Link href={`/my-bookings/${item.bookingId}`}>
                            <Button variant="outline">View Proof</Button>
                          </Link>
                        ) : null}
                    </div>
                  ))}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}