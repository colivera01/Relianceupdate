'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-dashed">
      <CardContent className="py-6 text-sm text-gray-600">{message}</CardContent>
    </Card>
  );
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
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Reviews</h1>
            <p className="text-sm text-gray-600">Your customer feedback hub.</p>
          </div>
          <Button variant="outline" onClick={() => void loadReviews()} disabled={loading || authLoading}>
            Refresh
          </Button>
        </div>

        {loading || authLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-gray-600">Loading your reviews...</CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <CardContent className="py-6 space-y-3">
              <p className="text-sm text-red-700">{error}</p>
              <Button type="button" variant="outline" onClick={() => void loadReviews()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !authLoading && !error ? (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Pending Reviews</h2>
              {data.pending.length === 0
                ? sectionEmptyState('No pending reviews right now.')
                : data.pending.map((item) => (
                    <Card key={item.bookingId}>
                      <CardContent className="py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          <p className="text-xs text-gray-500">Service date: {formatDate(item.serviceDate)}</p>
                        </div>
                        <Link href={`/my-bookings/${item.bookingId}`}>
                          <Button>Leave Review</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Submitted Reviews</h2>
              {data.submitted.length === 0
                ? sectionEmptyState('You have not submitted any reviews yet.')
                : data.submitted.map((item) => (
                    <Card key={item.reviewId}>
                      <CardContent className="py-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <p className="font-medium text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          {renderStars(item.rating)}
                          <p className="text-sm text-gray-600 line-clamp-2">{item.comment || 'No written comment.'}</p>
                          <p className="text-xs text-gray-500">Submitted: {formatDate(item.submittedAt)}</p>
                        </div>
                        {item.bookingId && (item.proofUrl || item.hasProof) ? (
                          <Link href={`/my-bookings/${item.bookingId}`}>
                            <Button variant="outline">View Proof</Button>
                          </Link>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Proof-Based Reviews</h2>
              {data.proofBased.length === 0
                ? sectionEmptyState('No proof-based reviews available yet.')
                : data.proofBased.map((item) => (
                    <Card key={`proof-${item.reviewId}`}>
                      <CardContent className="py-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <p className="font-medium text-gray-900">{item.serviceName}</p>
                          <p className="text-sm text-gray-700">{item.vendorName}</p>
                          {renderStars(item.rating)}
                          <p className="text-sm text-gray-600 line-clamp-2">{item.comment || 'No written comment.'}</p>
                          <p className="text-xs text-gray-500">Submitted: {formatDate(item.submittedAt)}</p>
                        </div>
                        {item.bookingId ? (
                          <Link href={`/my-bookings/${item.bookingId}`}>
                            <Button variant="outline">View Proof</Button>
                          </Link>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}