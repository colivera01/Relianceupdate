'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuidanceCallout } from '@/components/guidance/GuidanceCallout';
import { TrustScoreEducationCard } from '@/components/guidance/TrustScoreEducationCard';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { getClientSessionHeaders } from '@/lib/client-session';
import { tutorialGuides } from '@/lib/user-guidance';

type PendingReviewItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  videoUrl: string | null;
  proofUrl: string | null;
};

type AwaitingReviewItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  videoState: 'pending_approval' | 'approved_not_customer_visible' | 'rejected' | 'not_submitted';
  statusMessage: string;
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
  hasVideo: boolean;
  videoUrl: string | null;
  hasProof: boolean;
  proofUrl: string | null;
  hasLinkedMediaRecord: boolean;
  mediaState: 'customer_visible_video' | 'linked_media_unavailable' | 'no_linked_media';
  statusMessage: string | null;
};

type ReviewsMeResponse = {
  pending: PendingReviewItem[];
  awaiting: AwaitingReviewItem[];
  submitted: SubmittedReviewItem[];
};

function reviewsCacheKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `customer_reviews_cache:${userId}`;
}

function readCachedReviews(userId: string | null | undefined): ReviewsMeResponse | null {
  if (typeof window === 'undefined') return null;
  const key = reviewsCacheKey(userId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewsMeResponse>;
    return {
      pending: Array.isArray(parsed?.pending) ? parsed.pending : [],
      awaiting: Array.isArray(parsed?.awaiting) ? parsed.awaiting : [],
      submitted: Array.isArray(parsed?.submitted) ? parsed.submitted : [],
    };
  } catch {
    return null;
  }
}

function writeCachedReviews(userId: string | null | undefined, value: ReviewsMeResponse): void {
  if (typeof window === 'undefined') return;
  const key = reviewsCacheKey(userId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore client storage failures and keep the live view working.
  }
}

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

function bookingMetaRow(bookingId: string | null | undefined, dateLabel: string, dateValue: string | null | undefined) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      <p>{dateLabel}: {formatDate(dateValue)}</p>
      {bookingId ? (
        <p>
          Reference ID:{' '}
          <span className="font-mono text-[11px] text-gray-600">{bookingId}</span>
        </p>
      ) : null}
    </div>
  );
}

function reviewsBookingHref(bookingId: string): string {
  return `/my-bookings/${bookingId}?returnTo=${encodeURIComponent('/reviews')}`;
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
    awaiting: [],
    submitted: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCachedNotice, setShowCachedNotice] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError('Unauthorized. Sign in to view your reviews.');
      return;
    }

    setLoading(true);
    setError(null);
    setShowCachedNotice(false);
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

      const nextData = {
        pending: Array.isArray(json?.pending) ? json.pending : [],
        awaiting: Array.isArray(json?.awaiting) ? json.awaiting : [],
        submitted: Array.isArray(json?.submitted) ? json.submitted : [],
      };
      setData(nextData);
      writeCachedReviews(userId, nextData);
    } catch (fetchError) {
      const cachedData = readCachedReviews(userId);
      if (cachedData) {
        setData(cachedData);
        setShowCachedNotice(true);
        setError(null);
      } else {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load reviews');
        setData({
          pending: [],
          awaiting: [],
          submitted: [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void loadReviews();
  }, [authLoading, loadReviews]);

  const proofBackedSubmittedCount = data.submitted.filter((item) => item.hasProof).length;
  const awaitingVideoCount = data.awaiting.length;

  return (
    <div className="w-full max-w-5xl space-y-8">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Your reviews
        </div>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
              Review completed services
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              Your service is complete. You may leave an optional review after an approved customer-visible
              service video is available. If you submit nothing, your service record remains complete.
            </p>
            <p className="text-sm leading-7 text-white/68">
              {loading || authLoading
                ? 'Loading your review totals and service-record feedback history...'
                : `You have ${data.pending.length} ${data.pending.length === 1 ? 'service' : 'services'} ready for a review${
                    awaitingVideoCount > 0
                      ? `, ${awaitingVideoCount} completed ${awaitingVideoCount === 1 ? 'service is' : 'services are'} still waiting on review access,`
                      : ''
                  } and ${data.submitted.length} submitted ${data.submitted.length === 1 ? 'review' : 'reviews'}.${
                    proofBackedSubmittedCount > 0
                      ? ` ${proofBackedSubmittedCount} submitted ${
                          proofBackedSubmittedCount === 1 ? 'review is' : 'reviews are'
                        } tied to customer-visible service videos or images.`
                      : ''
                  }`}
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-slate-950/45 px-5 py-4 shadow-[0_18px_55px_rgba(4,10,22,0.24)]">
              <p className="text-xs uppercase tracking-[0.28em] text-white/46">Ready now</p>
              <p className="mt-2 text-3xl font-semibold text-white">{data.pending.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/45 px-5 py-4 shadow-[0_18px_55px_rgba(4,10,22,0.24)]">
              <p className="text-xs uppercase tracking-[0.28em] text-white/46">Not ready yet</p>
              <p className="mt-2 text-3xl font-semibold text-white">{awaitingVideoCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/45 px-5 py-4 shadow-[0_18px_55px_rgba(4,10,22,0.24)] sm:col-span-3 xl:col-span-1">
              <p className="text-xs uppercase tracking-[0.28em] text-white/46">Submitted</p>
              <p className="mt-2 text-3xl font-semibold text-white">{data.submitted.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <TrustScoreEducationCard surface="dark" />
        </div>
        <TutorialEntryPoint guide={tutorialGuides.reviewHub} surface="dark" className="self-start" />
      </div>

      <GuidanceCallout
        title="How your review is counted"
        description="Your star rating can affect the vendor's public business rating after Reliance approval. When you leave the review, you can tell Reliance whether the feedback is about the overall business, the assigned worker or crew, scheduling/management, or you are not sure."
        bullets={[
          'Public business rating: approved customer reviews customers can see.',
          'Private team performance: only used when feedback is clearly about the assigned worker or crew.',
          'Reliance Trust Score: separate from your star rating and based on verified operational activity.',
        ]}
        tone="blue"
      />

      <div className="flex items-center justify-end">
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
        <div className="reliance-operator-surface rounded-[28px] border border-red-200/70 bg-red-50/80 p-4 mb-10 space-y-3">
          <p className="text-sm text-red-700">We couldn&apos;t load your reviews.</p>
          <Button type="button" variant="outline" onClick={() => void loadReviews()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !authLoading && !error && showCachedNotice ? (
        <div className="reliance-operator-surface rounded-[28px] border border-amber-200/70 bg-amber-50/80 p-4 mb-6 text-sm text-amber-900">
          Showing your most recent saved review history while Reliance refreshes live review data.
        </div>
      ) : null}

      {!loading && !authLoading && !error ? (
        <>
          <section className="mb-10">
            <div className="space-y-1 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Optional Reviews Available</h2>
              <p className="text-sm text-gray-600">
                These completed services have approved customer-visible service videos. Review them whenever you choose.
              </p>
            </div>
            {data.pending.length === 0
              ? sectionEmptyState('You have no completed services with an optional review available.')
              : data.pending.map((item) => (
                  <div
                    key={item.bookingId}
                    className="reliance-operator-surface rounded-[28px] border border-amber-200/70 bg-amber-50/80 p-4 mb-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-gray-900">{item.serviceName}</p>
                      <p className="text-sm text-gray-700">{item.vendorName}</p>
                      {bookingMetaRow(item.bookingId, 'Service date', item.serviceDate)}
                    </div>
                    <Link href={reviewsBookingHref(item.bookingId)}>
                      <Button
                        size="default"
                        className="bg-[var(--reliance-blue)] text-white hover:bg-[#1f56cf]"
                      >
                        <Star className="mr-2 h-4 w-4 fill-current" />
                        Leave Review
                      </Button>
                    </Link>
                  </div>
                ))}
          </section>

          {data.awaiting.length > 0 ? (
            <section className="mb-10">
              <div className="space-y-1 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Optional Review Not Available Yet</h2>
                <p className="text-sm text-gray-600">
                  These completed services are not reviewable yet. Open the service record to see whether
                  the service video is pending approval, not customer-visible, or still unavailable.
                </p>
              </div>
              <GuidanceCallout
                title="Why some completed service records still are not reviewable"
                description="Reliance makes an optional review available only after an approved final-result customer-visible video exists for that service record."
                bullets={[
                  'Completed work can still be waiting on service-video approval.',
                  'A video can exist without being customer-visible yet.',
                  'Once the approved final-result video is available, this section moves the service record into Optional Reviews Available.',
                ]}
                tone="amber"
                className="mb-4"
              />
              {data.awaiting.map((item) => (
                <div
                  key={item.bookingId}
                  className="bg-white rounded-[28px] shadow-sm border p-4 mb-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">{item.serviceName}</p>
                    <p className="text-sm text-gray-700">{item.vendorName}</p>
                    {bookingMetaRow(item.bookingId, 'Service date', item.serviceDate)}
                    <p className="text-xs text-amber-700">{item.statusMessage}</p>
                  </div>
                  <Link href={reviewsBookingHref(item.bookingId)}>
                    <Button variant="outline">View service record</Button>
                  </Link>
                </div>
              ))}
            </section>
          ) : null}

          <section className="mb-10">
            <div className="space-y-1 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Submitted Reviews</h2>
              <p className="text-sm text-gray-600">
                Your saved review history. Reviews connected to customer-visible approved
                final-result videos are marked below.
              </p>
            </div>
            {data.submitted.length === 0
              ? sectionEmptyState('No submitted reviews yet. Your completed feedback will appear here.')
              : data.submitted.map((item) => (
                  <div
                    key={item.reviewId}
                    className="bg-white rounded-[28px] shadow-sm border p-4 mb-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="space-y-2.5">
                      {item.hasProof ? (
                        <p className="text-xs font-medium uppercase tracking-wide text-green-700">
                          Verified with customer-visible service video
                        </p>
                      ) : null}
                      <p className="text-lg font-semibold text-gray-900">{item.serviceName}</p>
                      <p className="text-sm text-gray-700">{item.vendorName}</p>
                      {bookingMetaRow(item.bookingId, 'Review submitted', item.submittedAt)}
                      {renderStars(item.rating)}
                      <p className="text-sm text-gray-600 leading-6 line-clamp-2">
                        {item.comment || 'No written comment.'}
                      </p>
                      {!item.hasProof && item.statusMessage ? (
                        <p className="text-xs text-gray-500">{item.statusMessage}</p>
                      ) : null}
                    </div>
                    {item.bookingId && item.videoUrl ? (
                      <Link href={reviewsBookingHref(item.bookingId)}>
                        <Button variant="outline">View service videos</Button>
                      </Link>
                    ) : item.bookingId ? (
                      <Link href={reviewsBookingHref(item.bookingId)}>
                        <Button variant="outline">View service record</Button>
                      </Link>
                    ) : null}
                  </div>
                ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
