'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { CustomerLoadError } from '@/components/customer/CustomerLoadError';
import { useCustomerLoad } from '@/hooks/useCustomerLoad';
import { customerReviewsResponseSchema } from '@/lib/customer-load-contract';

type ReadyReview = {
  bookingId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  archived: boolean;
};

type SubmittedReview = {
  reviewId: string;
  bookingId: string | null;
  vendorName: string;
  serviceName: string;
  rating: number;
  comment: string;
  submittedAt: string;
  employeeRating: { rating: number; employeeName: string } | null;
  commentStatus: 'NONE' | 'CHECKING' | 'PUBLISHED' | 'NOT_PUBLISHED' | 'LEGACY';
  ratingStatus: 'COUNTED' | 'INVALID';
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };
type ReviewsResponse = {
  ready: ReadyReview[];
  awaiting: Array<ReadyReview & { statusMessage: string }>;
  submitted: SubmittedReview[];
  counts: { ready: number; awaiting: number; submitted: number };
  pagination: { ready: Pagination; submitted: Pagination };
};

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
    </div>
  );
}

function commentStatusLabel(status: SubmittedReview['commentStatus']): string | null {
  if (status === 'CHECKING') return 'Written comment being checked before public display';
  if (status === 'PUBLISHED') return 'Written comment published';
  if (status === 'NOT_PUBLISHED') return 'Written comment not published';
  if (status === 'LEGACY') return 'Submitted under an earlier review contract';
  return null;
}

export default function ReviewsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = resolveCustomerUserId(user?.id);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [readyPage, setReadyPage] = useState(1);
  const [submittedPage, setSubmittedPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setReadyPage(1);
      setSubmittedPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams({ readyPage: String(readyPage), submittedPage: String(submittedPage), limit: '10' });
  if (search) params.set('search', search);
  const load = useCustomerLoad(`/api/reviews/me?${params}`, userId, !authLoading, customerReviewsResponseSchema, 'Unable to load your reviews.');
  const data = load.data as ReviewsResponse | null;
  const loading = load.status === 'loading';

  if (!authLoading && !userId) {
    return <div className="mx-auto max-w-4xl py-12"><p className="text-slate-700">Sign in to view your Customer Reviews.</p></div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 pb-12">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase text-blue-700">Your Reviews</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Customer Reviews</h1>
        <p className="mt-2 text-sm text-slate-600">Review completed services and revisit feedback you have submitted.</p>
        <label className="relative mt-5 block max-w-xl">
          <span className="sr-only">Search reviews</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search service, Vendor, or reference" className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm" />
        </label>
      </header>

      {load.error ? <CustomerLoadError message={load.error} onRetry={load.reload} /> : null}
      {loading ? <p className="text-sm text-slate-600">Loading Customer Reviews...</p> : null}

      {!loading && data ? (
        <>
          <section aria-labelledby="waiting-reviews-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 id="waiting-reviews-heading" className="text-2xl font-semibold text-slate-950">Reviews waiting for me</h2>
                <p className="mt-1 text-sm text-slate-600">{data.counts.ready} {data.counts.ready === 1 ? 'service is' : 'services are'} ready for your review.</p>
              </div>
            </div>
            {data.ready.length === 0 ? <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">No services are waiting for your review.</p> : (
              <div className="space-y-3">
                {data.ready.map((item) => (
                  <article key={item.bookingId} className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                    <div><h3 className="font-semibold text-slate-950">{item.serviceName}</h3><p className="text-sm text-slate-600">{item.vendorName} · {formatDate(item.serviceDate)}</p>{item.archived ? <p className="mt-1 text-xs text-slate-500">Archived Service Record</p> : null}</div>
                    <Link href={`/my-bookings/${item.bookingId}?action=review&returnTo=${encodeURIComponent('/reviews')}#your-review`} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Star className="h-4 w-4" /> Leave Review</Link>
                  </article>
                ))}
              </div>
            )}
            {data.pagination.ready.totalPages > 1 ? <Pager value={data.pagination.ready} onPrevious={() => setReadyPage((page) => page - 1)} onNext={() => setReadyPage((page) => page + 1)} /> : null}
          </section>

          {data.awaiting.length > 0 ? (
            <section aria-labelledby="not-ready-heading">
              <h2 id="not-ready-heading" className="text-lg font-semibold text-slate-950">Not ready yet</h2>
              <div className="mt-3 space-y-2">
                {data.awaiting.map((item) => <div key={item.bookingId} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><span className="font-medium text-slate-900">{item.serviceName}</span><span className="text-slate-600"> · {item.statusMessage}</span></div>)}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="submitted-reviews-heading">
            <div className="mb-4"><h2 id="submitted-reviews-heading" className="text-2xl font-semibold text-slate-950">Submitted Reviews</h2><p className="mt-1 text-sm text-slate-600">{data.counts.submitted} submitted {data.counts.submitted === 1 ? 'review' : 'reviews'}.</p></div>
            {data.submitted.length === 0 ? <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">No submitted reviews yet.</p> : (
              <div className="space-y-3">
                {data.submitted.map((item) => {
                  const moderationLabel = commentStatusLabel(item.commentStatus);
                  return <article key={item.reviewId} className="rounded-md border border-slate-200 bg-white p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-semibold text-slate-950">{item.serviceName}</h3><p className="text-sm text-slate-600">{item.vendorName} · {formatDate(item.submittedAt)}</p></div>{item.bookingId ? <Link href={`/my-bookings/${item.bookingId}`} className="text-sm font-semibold text-blue-700">View Service Record</Link> : null}</div>
                    <div className="mt-3"><p className="mb-1 text-xs font-medium text-slate-500">Vendor Rating</p><Stars rating={item.rating} /></div>
                    {item.comment ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.comment}</p> : <p className="mt-3 text-sm text-slate-500">No written comment.</p>}
                    {moderationLabel ? <p className="mt-2 text-xs text-slate-500">{moderationLabel}.</p> : null}
                    {item.employeeRating ? <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs font-medium text-slate-500">Service Professional Rating · {item.employeeRating.employeeName}</p><Stars rating={item.employeeRating.rating} /></div> : null}
                    {item.ratingStatus === 'INVALID' ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">This rating is not included in Vendor metrics.</p> : null}
                  </article>;
                })}
              </div>
            )}
            {data.pagination.submitted.totalPages > 1 ? <Pager value={data.pagination.submitted} onPrevious={() => setSubmittedPage((page) => page - 1)} onNext={() => setSubmittedPage((page) => page + 1)} /> : null}
          </section>

          <details className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-950">How ratings work</summary>
            <div className="mt-3 space-y-2"><p><strong>Vendor Rating:</strong> your overall experience with the business.</p><p><strong>Service Professional Rating:</strong> optional feedback about the person who performed the service.</p><p><strong>Reliance Trust Score:</strong> a separate measure based on verified platform activity.</p></div>
          </details>
        </>
      ) : null}
    </main>
  );
}

function Pager({ value, onPrevious, onNext }: { value: Pagination; onPrevious: () => void; onNext: () => void }) {
  return <nav aria-label="Review pages" className="mt-4 flex items-center justify-between"><p className="text-sm text-slate-500">Page {value.page} of {value.totalPages}</p><div className="flex gap-2"><button type="button" aria-label="Previous page" disabled={value.page <= 1} onClick={onPrevious} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next page" disabled={value.page >= value.totalPages} onClick={onNext} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></nav>;
}
