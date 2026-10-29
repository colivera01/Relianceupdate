'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Filter, Star } from 'lucide-react';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { ReportContentDialog } from '@/components/reports/ReportContentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';

type PublicService = { serviceId: string; serviceName: string };
type PublicReview = {
  reviewId: string;
  vendorId: string;
  serviceId: string | null;
  serviceName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerDisplayName: string;
};

type ReviewsResponse = {
  success: boolean;
  reviews?: PublicReview[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string;
};

const PAGE_SIZE = 12;

export default function VendorPublicReviewsPage() {
  const params = useParams();
  const vendorId = String(params?.vendorId || '');
  const { user } = useAuth();
  const userId = resolveCustomerUserId(user?.id);
  const isSignedIn = Boolean(userId);
  const isVendorAccount = user?.userType === 'vendor' || user?.userType === 'both';
  const accountHref = user?.userType === 'admin'
    ? '/admin/dashboard'
    : isVendorAccount
      ? '/vendor/dashboard'
      : isSignedIn
        ? '/user-dashboard'
        : '/auth/login';
  const accountLabel = user?.userType === 'admin'
    ? 'Admin Dashboard'
    : isSignedIn
      ? (isVendorAccount ? 'Vendor Workspace' : 'My Account')
      : 'Sign In';

  const [vendorName, setVendorName] = useState('Provider');
  const [services, setServices] = useState<PublicService[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const response = await fetch(`/api/vendors/${vendorId}/public`, { cache: 'no-store' });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json?.success === false) throw new Error(json?.error || 'Unable to load provider.');
        if (!cancelled) {
          setVendorName(String(json?.vendor?.vendorName || 'Provider'));
          setServices(Array.isArray(json?.publicServices) ? json.publicServices : []);
        }
      } catch {
        if (!cancelled) setVendorName('Provider');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    if (vendorId) void loadProfile();
    return () => { cancelled = true; };
  }, [vendorId]);

  const reviewQuery = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
    if (rating) query.set('rating', rating);
    if (serviceId) query.set('serviceId', serviceId);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return query.toString();
  }, [from, page, rating, serviceId, sort, to]);

  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vendors/${vendorId}/reviews/public?${reviewQuery}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => ({}))) as ReviewsResponse;
      if (!response.ok || json.success === false) throw new Error(json.error || 'Unable to load customer feedback.');
      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      setPagination(json.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    } catch (loadError) {
      setReviews([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load customer feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) void loadReviews();
  }, [reviewQuery, vendorId]);

  const updateFilter = (update: () => void) => {
    setPage(1);
    update();
  };
  const clearFilters = () => {
    setPage(1);
    setRating('');
    setServiceId('');
    setFrom('');
    setTo('');
    setSort('newest');
  };
  const hasFilters = Boolean(rating || serviceId || from || to || sort !== 'newest');
  const footerLinks = isSignedIn
    ? [{ href: accountHref, label: accountLabel }, { href: '/favorites', label: 'Saved Businesses' }]
    : undefined;

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <PublicSiteHeader
          tone="dark"
          secondaryHref={accountHref}
          secondaryLabel={accountLabel}
          ctaHref="/browse"
          ctaLabel="Explore Proof"
        />
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/vendors/${vendorId}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white/84 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {profileLoading ? 'provider' : vendorName}
        </Link>

        <section className="mt-7 overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.28),transparent_42%),linear-gradient(135deg,#07111f,#0c1e39_62%,#102f62)] px-6 py-8 shadow-[0_30px_90px_rgba(0,0,0,0.34)] sm:px-9 sm:py-10">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">Published customer feedback</div>
          <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Reviews for {vendorName}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/72">
            Browse moderated written feedback from verified customer reviews. Star-rating totals may be higher because customers can submit a verified rating without publishing a written comment.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80">
            <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
            {pagination.total} published written review{pagination.total === 1 ? '' : 's'}
          </div>
        </section>

        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-xl sm:p-6" aria-label="Review filters">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 font-semibold"><Filter className="h-4 w-4" /> Filter reviews</div>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-sm font-semibold text-blue-200 underline-offset-4 hover:underline">Clear filters</button>
            ) : null}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-2 text-sm font-medium text-white/72">
              Service
              <select value={serviceId} onChange={(event) => updateFilter(() => setServiceId(event.target.value))} className="w-full rounded-xl border border-white/12 bg-[#0d1828] px-3 py-2.5 text-white">
                <option value="">All services</option>
                {services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.serviceName}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-white/72">
              Rating
              <select value={rating} onChange={(event) => updateFilter(() => setRating(event.target.value))} className="w-full rounded-xl border border-white/12 bg-[#0d1828] px-3 py-2.5 text-white">
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-white/72">
              From
              <input type="date" value={from} max={to || undefined} onChange={(event) => updateFilter(() => setFrom(event.target.value))} className="w-full rounded-xl border border-white/12 bg-[#0d1828] px-3 py-2.5 text-white" />
            </label>
            <label className="space-y-2 text-sm font-medium text-white/72">
              To
              <input type="date" value={to} min={from || undefined} onChange={(event) => updateFilter(() => setTo(event.target.value))} className="w-full rounded-xl border border-white/12 bg-[#0d1828] px-3 py-2.5 text-white" />
            </label>
            <label className="space-y-2 text-sm font-medium text-white/72">
              Sort
              <select value={sort} onChange={(event) => updateFilter(() => setSort(event.target.value as 'newest' | 'oldest'))} className="w-full rounded-xl border border-white/12 bg-[#0d1828] px-3 py-2.5 text-white">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </section>

        <section className="mt-8" aria-live="polite">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-[28px] border border-white/8 bg-white/6" />)}
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-amber-300/25 bg-amber-300/10 p-6 text-amber-100">
              <div className="font-semibold">Customer feedback is temporarily unavailable</div>
              <p className="mt-2 text-sm text-amber-100/80">{error}</p>
              <button type="button" onClick={() => void loadReviews()} className="mt-4 rounded-full border border-amber-200/30 px-4 py-2 text-sm font-semibold hover:bg-amber-200/10">Try again</button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/6 p-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-white/44" />
              <h2 className="mt-4 text-2xl font-semibold">No published reviews match these filters</h2>
              <p className="mt-2 text-white/62">Try a different service, date range, or rating.</p>
              {hasFilters ? <button type="button" onClick={clearFilters} className="mt-5 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Clear filters</button> : null}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.reviewId} className="rounded-[28px] border border-white/10 bg-white/7 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{review.reviewerDisplayName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/58">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-2.5 py-1 text-amber-200"><Star className="h-3.5 w-3.5 fill-current" />{review.rating}/5</span>
                        <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ReportContentDialog
                      targetType="review"
                      targetId={review.reviewId}
                      isSignedIn={isSignedIn}
                      userId={userId}
                      triggerLabel={isSignedIn ? 'Report' : 'Sign in to report'}
                      title="Report this review"
                      description="Tell us if this review seems inappropriate, unsafe, or misleading."
                      signInHref={`/auth/login?next=${encodeURIComponent(`/vendors/${vendorId}/reviews`)}`}
                      className="text-xs font-medium text-white/48 underline-offset-4 hover:text-red-300 hover:underline"
                    />
                  </div>
                  {review.serviceId && review.serviceName ? (
                    <Link href={`/service/${review.serviceId}?returnTo=${encodeURIComponent(`/vendors/${vendorId}/reviews`)}&returnLabel=Back%20to%20Reviews`} className="mt-4 inline-flex rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-400/16">
                      {review.serviceName}
                    </Link>
                  ) : null}
                  <p className="mt-4 text-sm leading-7 text-white/76">{review.comment}</p>
                </article>
              ))}
            </div>
          )}

          {!loading && !error && pagination.totalPages > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Review pages">
              <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/8">Previous</button>
              <span className="text-sm text-white/64">Page {pagination.page} of {pagination.totalPages}</span>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/8">Next</button>
            </nav>
          ) : null}
        </section>
      </main>

      <PublicSiteFooter accountLinksOverride={footerLinks} accountHeading={isSignedIn ? 'Your account' : undefined} />
    </div>
  );
}
