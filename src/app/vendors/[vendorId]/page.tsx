'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LazyVideoFrame } from '@/components/public/LazyVideoFrame';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { PublicTrustScorePanel } from '@/components/public/PublicTrustScorePanel';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { PUBLIC_DB_UNAVAILABLE_CODE, PUBLIC_DB_UNAVAILABLE_MESSAGE } from '@/lib/transient-db-errors';
import { ReportContentDialog } from '@/components/reports/ReportContentDialog';
import { VendorFavoriteButton } from '@/components/favorites/VendorFavoriteButton';
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock, Eye, Globe2, MapPin, ShieldCheck, Star } from 'lucide-react';

interface PublicService {
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  price: number | null;
  previewMediaUrl: string | null;
  previewMediaType: 'image' | 'video' | null;
}

interface PublicMediaItem {
  mediaId: string;
  serviceId: string | null;
  serviceName?: string | null;
  title: string;
  mimeType: string;
  url: string;
  createdAt: string;
  stageKey?: string | null;
  stageLabel?: string | null;
  isPrimaryServiceVideo?: boolean;
  isPrimaryProofVideo?: boolean;
}

interface PublicVendorPayload {
  success: boolean;
  vendor?: {
    vendorId: string;
    vendorName: string;
    businessType: string | null;
    category: string | null;
    bio: string | null;
    website: string | null;
    foundedYear: number | null;
    specialties: string[];
    location: string | null;
    serviceAreas: string[];
    businessHours?: {
      configured: boolean;
      openNow: boolean | null;
      label: string;
      todayLabel: string | null;
      timezone: string | null;
      schedule: Array<{
        day: string;
        dayLabel: string;
        enabled: boolean;
        hoursLabel: string;
      }>;
    };
    profilePhoto: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  publicServices?: PublicService[];
  publicMedia?: PublicMediaItem[];
  publicProofSummary?: {
    completedWorkCount: number;
    publicMediaCount: number;
    servicesWithPublicProof: number;
  };
  meta?: {
    serviceEligibilityRule?: string;
    reviewEligibilityRule?: string;
  };
  error?: string;
}

interface PublicVendorReview {
  reviewId: string;
  vendorId: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerDisplayName: string;
}

const PUBLIC_VENDOR_RETRY_ATTEMPTS = 3;
const PUBLIC_VENDOR_RETRY_DELAY_MS = 1_200;

function sanitizeReturnPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  return value;
}

function sanitizeReturnLabel(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export default function PublicVendorProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const vendorId = String(params?.vendorId || '');
  const { user } = useAuth();
  const userId = resolveCustomerUserId(user?.id);
  const isSignedIn = Boolean(userId);
  const isVendorPreview = searchParams?.get('preview') === 'vendor';
  const returnTo = sanitizeReturnPath(searchParams?.get('returnTo') || null) || '/browse';
  const returnLabel = sanitizeReturnLabel(searchParams?.get('returnLabel') || null) || 'Back to Explore Proof';
  const isVendorAccount = user?.userType === 'vendor' || user?.userType === 'both';
  const signedInAccountHref =
    user?.userType === 'admin' ? '/admin/dashboard' : isVendorAccount ? '/vendor/dashboard' : '/user-dashboard';
  const headerAccountHref = isVendorPreview ? '/vendor/dashboard' : isSignedIn ? signedInAccountHref : '/auth/login';
  const headerAccountLabel = isVendorPreview ? 'Vendor Workspace' : isSignedIn ? 'My Account' : 'Sign In';

  const [payload, setPayload] = useState<PublicVendorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PublicVendorReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const fetchRetryablePublicJson = async (url: string) => {
    let lastResponse: Response | null = null;
    let lastJson: any = {};

    for (let attempt = 0; attempt < PUBLIC_VENDOR_RETRY_ATTEMPTS; attempt += 1) {
      const response = await fetch(url, { cache: 'no-store' });
      lastResponse = response;
      let json: any = {};
      try {
        json = await response.json();
      } catch {
        json = {};
      }
      lastJson = json;

      const retryableDbUnavailable =
        response.status === 503 || json?.code === PUBLIC_DB_UNAVAILABLE_CODE;

      if (!retryableDbUnavailable || attempt === PUBLIC_VENDOR_RETRY_ATTEMPTS - 1) {
        return { response, json };
      }

      await new Promise((resolve) => window.setTimeout(resolve, PUBLIC_VENDOR_RETRY_DELAY_MS));
    }

    if (!lastResponse) {
      throw new Error('Public vendor request could not be started.');
    }

    return { response: lastResponse, json: lastJson };
  };

  const loadVendorProfile = async () => {
    if (!vendorId) return;
    setLoading(true);
    setError(null);
    try {
      const { response: res, json } = await fetchRetryablePublicJson(`/api/vendors/${vendorId}/public`);
      if (!res.ok || json?.success === false) {
        if (res.status === 503 || json?.code === PUBLIC_DB_UNAVAILABLE_CODE) {
          throw new Error(PUBLIC_DB_UNAVAILABLE_MESSAGE);
        }
        throw new Error(json?.error || `Failed to load vendor (${res.status})`);
      }
      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor profile');
    } finally {
      setLoading(false);
    }
  };

  const loadPublicReviews = async () => {
    if (!vendorId) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const { response: res, json } = await fetchRetryablePublicJson(`/api/vendors/${vendorId}/reviews/public`);
      if (!res.ok || json?.success === false) {
        if (res.status === 503 || json?.code === PUBLIC_DB_UNAVAILABLE_CODE) {
          throw new Error('Public reviews are temporarily unavailable. Please try again in a moment.');
        }
        throw new Error(json?.error || `Failed to load reviews (${res.status})`);
      }
      setReviews(Array.isArray(json?.reviews) ? json.reviews : []);
    } catch (err) {
      setReviewsError(err instanceof Error ? err.message : 'Failed to load public reviews');
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    void loadVendorProfile();
  }, [vendorId]);

  useEffect(() => {
    void loadPublicReviews();
  }, [vendorId]);

  const vendor = payload?.vendor || null;
  const services = payload?.publicServices || [];
  const media = payload?.publicMedia || [];
  const publicProofSummary = payload?.publicProofSummary || {
    completedWorkCount: 0,
    publicMediaCount: media.length,
    servicesWithPublicProof: 0,
  };
  const primaryServiceVideo = useMemo(
    () =>
      media.find(
        (item) =>
          Boolean(item?.isPrimaryServiceVideo || item?.isPrimaryProofVideo) &&
          String(item?.mimeType || '').toLowerCase().startsWith('video/') &&
          Boolean(String(item?.url || '').trim())
      ) || null,
    [media]
  );

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)]">
      <section className="reliance-dark-shell relative overflow-hidden pb-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_18%,rgba(53,214,165,0.12),transparent_18%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <PublicSiteHeader
            tone="dark"
            className="mb-10"
            links={[
              { href: '/', label: 'Home' },
              { href: '/browse', label: 'Explore Proof' },
              { href: '/help', label: 'Help' },
            ]}
            ctaHref="/browse"
            ctaLabel="Explore Proof"
            secondaryHref={headerAccountHref}
            secondaryLabel={headerAccountLabel}
          />

          {isVendorPreview ? (
            <div
              className="mb-6 flex flex-col gap-4 rounded-[24px] border border-blue-300/25 bg-blue-400/10 px-5 py-4 text-white shadow-[0_18px_55px_rgba(2,8,23,0.28)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
              data-testid="vendor-public-profile-preview-banner"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200/20 bg-blue-300/10">
                  <Eye aria-hidden="true" className="h-5 w-5 text-blue-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">You are previewing your public profile</p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-white/72">
                    This is exactly what customers can see. Only public-approved business details, services,
                    reviews, reliability signals, and Service Videos appear here.
                    {isSignedIn
                      ? ' You remain signed in while previewing, and Vendor Workspace returns you to your management area.'
                      : ''}
                  </p>
                </div>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                {isSignedIn ? 'Signed-in customer view' : 'Customer view'}
              </div>
            </div>
          ) : null}

          <div className="mb-8">
            <Link href={returnTo}>
              <Button
                variant="outline"
                className="rounded-full border-white/12 bg-white/8 text-white hover:bg-white/12 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {returnLabel}
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/12 bg-white/8 px-6 py-5 text-sm text-white/82 backdrop-blur-xl">
                Reliance is loading this public vendor profile now. Services offered, reviews, and any approved
                service videos will appear as soon as the listing is ready.
              </div>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="h-72 animate-pulse rounded-[32px] bg-white/10" />
                <div className="h-72 animate-pulse rounded-[32px] bg-white/10" />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-6 text-amber-900">
              <p className="text-sm font-semibold">Public vendor profile temporarily unavailable</p>
              <p className="mt-2 text-sm">{error}</p>
              <p className="mt-2 text-sm text-amber-800">
                This usually means the public page is having trouble loading right now, not that the vendor profile was removed.
              </p>
              <Button variant="outline" className="mt-4 rounded-full" onClick={() => void loadVendorProfile()}>
                Try Again
              </Button>
            </div>
          ) : !vendor ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 text-slate-700">
              Public vendor profile not found.
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
              <div>
                <div className="reliance-kicker border border-white/10 bg-white/10 text-white/76">
                  {isVendorPreview ? 'Customer-facing provider profile' : 'About this provider'}
                </div>
                <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.98] text-white sm:text-6xl">
                  {vendor.vendorName}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/74">
                  Compare specialties, approved services, business hours, verified customer feedback,
                  reliability context, and customer-shared completed work in one place.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <VendorFavoriteButton vendorId={vendor.vendorId} vendorName={vendor.vendorName} tone="dark" />
                  {vendor.category ? (
                    <Badge className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/10">{vendor.category}</Badge>
                  ) : null}
                  {vendor.businessType ? (
                    <Badge className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/10">{vendor.businessType}</Badge>
                  ) : null}
                  {vendor.location ? (
                    <Badge className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/10">
                      <MapPin className="mr-1 h-3.5 w-3.5" />
                      {vendor.location}
                    </Badge>
                  ) : null}
                  {vendor.website ? (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
                    >
                      <Globe2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Visit business website
                    </a>
                  ) : null}
                  {vendor.foundedYear ? (
                    <Badge className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/10">
                      Serving since {vendor.foundedYear}
                    </Badge>
                  ) : null}
                  {vendor.businessHours ? (
                    <Badge
                      className={`rounded-full px-4 py-2 text-white hover:bg-white/10 ${
                        vendor.businessHours.openNow === true
                          ? 'bg-emerald-500/22'
                          : vendor.businessHours.openNow === false
                            ? 'bg-amber-500/18'
                            : 'bg-white/10'
                      }`}
                      title={vendor.businessHours.todayLabel || undefined}
                    >
                      <Clock className="mr-1 h-3.5 w-3.5" />
                      {vendor.businessHours.openNow === true ? 'Open now' : vendor.businessHours.label}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/56">Customer rating</div>
                    <div className="mt-3 text-3xl font-semibold">
                      {typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : 'New'}
                    </div>
                    <div className="mt-1 text-sm text-white/66">
                      {typeof vendor.reviewCount === 'number'
                        ? `${vendor.reviewCount} verified customer rating${vendor.reviewCount === 1 ? '' : 's'}`
                        : 'Customer ratings are still building'}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/56">Public-approved services</div>
                    <div className="mt-3 text-3xl font-semibold">{services.length}</div>
                    <div className="mt-1 text-sm text-white/66">Services currently approved for customer viewing</div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/56">Public completed work</div>
                    <div className="mt-3 text-3xl font-semibold">{publicProofSummary.completedWorkCount}</div>
                    <div className="mt-1 text-sm text-white/66">Customer-shared completed service records</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3" aria-label="Public profile sections">
                  <Link href="#services-offered" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14">
                    View services offered
                  </Link>
                  <Link href="#public-work" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14">
                    See completed public work
                  </Link>
                  <Link href="#customer-reviews" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14">
                    Read customer reviews
                  </Link>
                </div>
              </div>

              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-5 shadow-[0_30px_80px_rgba(4,9,20,0.38)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">
                      Public service video
                    </div>
                    <div className="mt-2 font-display text-2xl text-white">
                      {primaryServiceVideo?.title || 'Public service video'}
                    </div>
                  </div>
                  <Badge
                    className={
                      primaryServiceVideo
                        ? 'bg-emerald-500 text-white hover:bg-emerald-500'
                        : 'bg-white/10 text-white/72 hover:bg-white/10'
                    }
                  >
                    {primaryServiceVideo ? 'Verified Service Video' : 'No public video yet'}
                  </Badge>
                </div>

                {primaryServiceVideo ? (
                  <LazyVideoFrame
                    src={primaryServiceVideo.url}
                    title={primaryServiceVideo.title || 'Completed service video'}
                    buttonLabel="Load featured video"
                    className="h-[320px] w-full rounded-[24px] border border-white/10 bg-black"
                  />
                ) : (
                  <PublicMediaPreview
                    alt={`${vendor.vendorName} public service video`}
                    className="h-[320px] w-full rounded-[24px] border border-white/10"
                    emptyLabel="No public service video is available yet for this vendor."
                  />
                )}

                <p className="mt-4 text-sm leading-6 text-white/70">
                  {vendor.bio || 'This vendor profile is publicly listed and ready for customer review.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {!loading && !error && vendor ? (
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-8">
              <PublicTrustScorePanel
                vendorId={vendor.vendorId}
                customerRating={vendor.rating ?? null}
                customerReviewCount={vendor.reviewCount ?? null}
              />

              <section className="reliance-light-card rounded-[32px] px-6 py-6" data-testid="public-business-specialties">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200/20 bg-blue-400/10 text-blue-100">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Business specialties
                    </div>
                    <h2 className="mt-2 font-display text-3xl font-semibold text-slate-950">What this business specializes in</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Specialties come from the vendor profile. Bookable customer offerings remain listed separately under Services Offered.
                    </p>
                  </div>
                </div>

                {vendor.specialties?.length ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {vendor.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="rounded-full border border-blue-200/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    This provider has not published business specialties yet. Services Offered below are still the authoritative customer menu.
                  </div>
                )}
                {isVendorPreview ? (
                  <Link
                    href="/vendor/profile#business-specialties"
                    className="mt-5 inline-flex rounded-full border border-blue-200/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/16"
                  >
                    Update business specialties
                  </Link>
                ) : null}
              </section>

              <section className="reliance-light-card rounded-[32px] px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Service Footprint
                    </div>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Where this vendor works</h2>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="font-semibold text-slate-950">
                        {vendor.businessHours?.openNow === true ? 'Open now' : vendor.businessHours?.label || 'Hours not listed'}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {vendor.businessHours?.todayLabel || 'This provider has not listed weekly service hours yet.'}
                      </p>
                    </div>
                  </div>
                </div>

                {vendor.businessHours?.configured && vendor.businessHours.schedule?.length ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        Weekly business hours
                      </div>
                      {vendor.businessHours.timezone ? (
                        <span className="text-xs text-slate-500">
                          {vendor.businessHours.timezone.replaceAll('_', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {vendor.businessHours.schedule.map((day) => (
                        <div
                          key={day.day}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/5 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">{day.dayLabel}</span>
                          <span className={day.enabled ? 'font-semibold text-slate-950' : 'text-slate-500'}>
                            {day.hoursLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {isVendorPreview ? (
                  <Link
                    href="/vendor/profile#business-hours"
                    className="mt-4 inline-flex rounded-full border border-blue-200/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/16"
                  >
                    {vendor.businessHours?.configured ? 'Update business hours' : 'Add and save business hours'}
                  </Link>
                ) : null}

                {vendor.serviceAreas?.length ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {vendor.serviceAreas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    Public service areas are not listed yet.
                  </div>
                )}
              </section>

            </div>

            <div className="space-y-8">
              <section id="services-offered" className="reliance-light-card scroll-mt-6 rounded-[32px] px-6 py-6" data-testid="public-approved-services">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Public-approved services
                    </div>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Services Offered</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      These are the vendor's currently published, customer-available services. Open one to review its details and any public work attached to it.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                      {services.length} live
                    </Badge>
                    {isVendorPreview ? (
                      <Link href="/vendor/services" className="text-xs font-semibold text-blue-100 underline-offset-4 hover:underline">
                        Manage services
                      </Link>
                    ) : null}
                  </div>
                </div>

                {services.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No public services offered are available for this vendor yet.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    {services.map((service) => (
                      <Card
                        key={service.serviceId}
                        className="group overflow-hidden rounded-[28px] border-slate-200 shadow-none transition duration-300 hover:-translate-y-1 hover:border-blue-300/35 hover:shadow-[0_22px_50px_rgba(0,0,0,0.26)]"
                      >
                        <PublicMediaPreview
                          url={service.previewMediaUrl}
                          type={service.previewMediaType}
                          alt={service.serviceName}
                          className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                          videoLabel="Service video available"
                        />
                        <CardContent className="space-y-3 p-5">
                          <div className="font-display text-xl font-semibold text-slate-950">{service.serviceName}</div>
                          <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                            {service.serviceDescription || 'No description available.'}
                          </p>
                          {typeof service.price === 'number' ? (
                            <div className="text-sm font-semibold text-slate-950">
                              Reference price: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(service.price)}
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">
                              {service.previewMediaUrl ? 'Public preview available' : 'Service offered'}
                            </div>
                            <Link href={`/service/${service.serviceId}?returnTo=${encodeURIComponent(`/vendors/${vendorId}`)}&returnLabel=Back%20to%20Vendor%20Page`}>
                              <Button size="sm" className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
                                View service &amp; public work
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section id="public-work" className="reliance-light-card scroll-mt-6 rounded-[32px] px-6 py-6" data-testid="public-work-library">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Customer-shared proof
                    </div>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Completed public work</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Only completed work that passed Reliance review and was separately shared publicly by the customer appears here.
                    </p>
                  </div>
                  <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {publicProofSummary.completedWorkCount} public
                  </Badge>
                </div>

                {media.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No customer-shared completed work is public yet. This does not mean the vendor has no completed jobs; private work remains private unless the customer chooses to share it.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {media.map((item) => (
                      <div key={item.mediaId} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
                        {String(item.mimeType || '').startsWith('video/') ? (
                          <LazyVideoFrame
                            src={item.url}
                            title={item.title}
                            buttonLabel="Load video preview"
                            controls={false}
                            muted
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <img src={item.url} alt={item.title} className="h-40 w-full object-cover" />
                        )}
                        <div className="space-y-2 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-slate-950">{item.serviceName || item.title}</div>
                            {item.stageLabel ? (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                {item.stageLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Building2 className="h-3.5 w-3.5" />
                            {item.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isVendorPreview ? (
                  <Link
                    href="/vendor/jobs"
                    className="mt-5 inline-flex rounded-full border border-blue-200/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/16"
                  >
                    Review completed jobs &amp; visibility
                  </Link>
                ) : null}
              </section>

              <section id="customer-reviews" className="reliance-light-card scroll-mt-6 rounded-[32px] px-6 py-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Public Reviews
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Customer feedback</h2>

                {reviewsLoading ? (
                  <div className="mt-6 space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                ) : reviewsError ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    {reviewsError}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No public reviews are available yet.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {reviews.map((review) => (
                      <div key={review.reviewId} className="rounded-[24px] border border-slate-200 bg-white px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-950">{review.reviewerDisplayName}</div>
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                <Star className="h-3.5 w-3.5 fill-current" />
                                {review.rating}/5
                              </span>
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
                            signInHref={`/auth/login?next=${encodeURIComponent(`/vendors/${vendorId}`)}`}
                            className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-red-700 hover:underline"
                          />
                        </div>
                        <p className="mt-4 text-sm leading-7 text-slate-700">{review.comment || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <PublicSiteFooter
        accountHeading={isVendorPreview ? 'Vendor workspace' : undefined}
        accountLinksOverride={
          isVendorPreview
            ? [
                { href: '/vendor/dashboard', label: 'Vendor Dashboard' },
                { href: '/vendor/profile', label: 'Profile & Settings' },
                { href: '/vendor/services', label: 'Manage Services' },
              ]
            : isSignedIn
              ? [{ href: signedInAccountHref, label: 'My Account' }]
              : undefined
        }
      />
    </div>
  );
}
