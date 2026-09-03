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
import { ArrowLeft, Building2, Clock, MapPin, ShieldCheck, Star, Video } from 'lucide-react';

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
    location: string | null;
    serviceAreas: string[];
    businessHours?: {
      configured: boolean;
      openNow: boolean | null;
      label: string;
      todayLabel: string | null;
    };
    profilePhoto: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  publicServices?: PublicService[];
  publicMedia?: PublicMediaItem[];
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
  const returnTo = sanitizeReturnPath(searchParams?.get('returnTo') || null) || '/browse';
  const returnLabel = sanitizeReturnLabel(searchParams?.get('returnLabel') || null) || 'Back to Explore Proof';

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
  const galleryMedia = useMemo(
    () => media.filter((item) => item.mediaId !== primaryServiceVideo?.mediaId),
    [media, primaryServiceVideo]
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
          />

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
                  About this provider
                </div>
                <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.98] text-white sm:text-6xl">
                  {vendor.vendorName}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/74">
                  See service details, public reviews, and any available public service videos in one place.
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
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/56">Services offered</div>
                    <div className="mt-3 text-3xl font-semibold">{services.length}</div>
                    <div className="mt-1 text-sm text-white/66">Approved services offered currently shown to customers</div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/56">Service videos</div>
                    <div className="mt-3 text-3xl font-semibold">{media.length}</div>
                    <div className="mt-1 text-sm text-white/66">Public-safe photos and videos in this profile</div>
                  </div>
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

              <section className="reliance-light-card rounded-[32px] px-6 py-6">
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

            <div className="space-y-8">
              <section className="reliance-light-card rounded-[32px] px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Services Offered
                    </div>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Services Offered</h2>
                  </div>
                  <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                    {services.length} live
                  </Badge>
                </div>

                {services.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No public services offered are available for this vendor yet.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    {services.map((service) => (
                      <Card key={service.serviceId} className="overflow-hidden rounded-[28px] border-slate-200 shadow-none">
                        <PublicMediaPreview
                          url={service.previewMediaUrl}
                          type={service.previewMediaType}
                          alt={service.serviceName}
                          className="h-40 w-full object-cover"
                          videoLabel="Service video available"
                        />
                        <CardContent className="space-y-3 p-5">
                          <div className="font-display text-xl font-semibold text-slate-950">{service.serviceName}</div>
                          <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                            {service.serviceDescription || 'No description available.'}
                          </p>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">
                              {service.previewMediaUrl ? 'Public preview available' : 'Service offered'}
                            </div>
                            <Link href={`/service/${service.serviceId}?returnTo=${encodeURIComponent(`/vendors/${vendorId}`)}&returnLabel=Back%20to%20Vendor%20Page`}>
                              <Button size="sm" className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
                                View Work Type
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section className="reliance-light-card rounded-[32px] px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Service Timeline
                    </div>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Recent public service videos</h2>
                  </div>
                  <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    Verified Service Videos
                  </Badge>
                </div>

                {galleryMedia.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No additional public service videos are available yet.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {galleryMedia.map((item) => (
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
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <PublicSiteFooter />
    </div>
  );
}
