'use client';
import React, { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { PUBLIC_DB_UNAVAILABLE_CODE, PUBLIC_DB_UNAVAILABLE_MESSAGE } from '@/lib/transient-db-errors';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { TrustScoreEducationCard } from '@/components/guidance/TrustScoreEducationCard';
import { ReportContentDialog } from '@/components/reports/ReportContentDialog';
import { ServiceImage } from '@/components/ServiceImage';
import { LazyVideoFrame } from '@/components/public/LazyVideoFrame';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { RelianceLogo } from '@/components/public/RelianceLogo';
import { PublicTrustScorePanel } from '@/components/public/PublicTrustScorePanel';
import { tutorialGuides } from '@/lib/user-guidance';
import { 
  MapPin, 
  Star, 
  Clock, 
  Phone, 
  Mail, 
  Calendar, 
  Heart, 
  Share2, 
  ChevronLeft,
  CheckCircle,
  Award,
  Shield,
  Clock as TimeIcon
} from 'lucide-react';

function getPublicVendorEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email) return null;
  if (/@(?:example\.(?:com|org|net)|reliance\.test)$/i.test(email)) return null;
  return email;
}

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

const SERVICE_DETAIL_TIMEOUT_MS = 30_000;
const SERVICE_DETAIL_RETRY_ATTEMPTS = 3;
const PUBLIC_DB_RETRY_DELAY_MS = 1_200;

type ServiceVideoItem = {
  id: string;
  url: string;
  isPrimaryProofVideo?: boolean;
  createdAt?: string | null;
  stageKey?: string | null;
  stageLabel?: string | null;
};

function formatMediaTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ServiceDetailLoadingState() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnPath(searchParams?.get('returnTo') || null);
  const returnLabel = sanitizeReturnLabel(searchParams?.get('returnLabel') || null);
  const resolvedBackHref = returnTo || (user?.id ? '/discover' : '/');
  const resolvedBackLabel = returnLabel || (user?.id ? 'Back to Discover' : 'Back to Home Page');

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)]">
      <div className="sticky top-0 z-10 border-b border-white/8 bg-[rgba(4,9,18,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <RelianceLogo
            href={resolvedBackHref}
            tone="light"
            compact
            blend
            frameClassName="h-[4.8rem] w-[4.8rem]"
          />
          <Link
            href={resolvedBackHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white/72 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>{resolvedBackLabel}</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 rounded-[28px] border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900 shadow-sm">
          Reliance is loading this public service listing now. Provider details, reviews, and any public service video will appear as soon as the page is ready.
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-96 bg-[linear-gradient(135deg,#0d1b35,#123b78_60%,#1d6dff)]" />
              <div className="space-y-4 p-6">
                <div className="h-8 w-3/4 rounded bg-slate-100" />
                <div className="h-4 w-1/2 rounded bg-slate-100" />
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-6 w-40 rounded bg-slate-100" />
              <div className="mt-4 h-4 w-full rounded bg-slate-100" />
              <div className="mt-3 h-4 w-4/5 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-3/5 rounded bg-slate-100" />
            </div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-7 w-32 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
              <div className="mt-3 h-11 w-full rounded-full bg-slate-100" />
              <div className="mt-3 h-11 w-full rounded-xl bg-slate-100" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-6 w-36 rounded bg-slate-100" />
              <div className="mt-4 h-4 w-5/6 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const serviceId = String(params?.serviceId ?? "");
  const isSignedIn = Boolean(user?.id);
  const returnTo = sanitizeReturnPath(searchParams?.get('returnTo') || null);
  const returnLabel = sanitizeReturnLabel(searchParams?.get('returnLabel') || null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'photos'>('overview');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [service, setService] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteResolved, setFavoriteResolved] = useState(false);

  const loadServiceData = async (isMounted: () => boolean) => {
    const fetchServiceResponse = async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < SERVICE_DETAIL_RETRY_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SERVICE_DETAIL_TIMEOUT_MS);

        try {
          const response = await fetch(`/api/services/${serviceId}`, {
            signal: controller.signal,
          });
          if (response.status === 503 && attempt < SERVICE_DETAIL_RETRY_ATTEMPTS - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, PUBLIC_DB_RETRY_DELAY_MS));
            continue;
          }
          return response;
        } catch (error) {
          lastError = error;
          if ((error as { name?: string })?.name !== 'AbortError') {
            throw error;
          }
          if (attempt < SERVICE_DETAIL_RETRY_ATTEMPTS - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, PUBLIC_DB_RETRY_DELAY_MS));
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      throw lastError ?? new Error('Service details took too long to load.');
    };

    try {
      if (!isMounted()) return;
      setLoading(true);
      setError(null);

      const serviceResponse = await fetchServiceResponse();
      const serviceData = await serviceResponse.json().catch(() => ({}));
      if (!serviceResponse.ok) {
        if (serviceResponse.status === 404) {
          if (!isMounted()) return;
          setService(null);
          setError(null);
          return;
        }
        if (serviceResponse.status === 503 || serviceData?.code === PUBLIC_DB_UNAVAILABLE_CODE) {
          throw new Error(PUBLIC_DB_UNAVAILABLE_MESSAGE);
        }
        throw new Error(serviceData?.error || 'Failed to fetch service details');
      }
      if (!isMounted()) return;
      setService(serviceData.service);
      setLoading(false);

      fetch(`/api/services/${serviceId}/reviews/public`, {
        cache: 'no-store',
      })
        .then(async (reviewsResponse) => {
          if (!reviewsResponse.ok || !isMounted()) return;
          const reviewsData = await reviewsResponse.json();
          if (isMounted()) {
            setReviews(reviewsData.reviews || []);
          }
        })
        .catch((err) => {
          console.error('Error fetching service reviews:', err);
        });

      if (serviceData.service.vendor?.id) {
        fetch(`/api/availability/vendor/${serviceData.service.vendor.id}?serviceId=${encodeURIComponent(serviceId)}`)
          .then(async (availabilityResponse) => {
            if (!availabilityResponse.ok || !isMounted()) return;
            const availabilityData = await availabilityResponse.json();
            if (isMounted()) {
              setAvailability(availabilityData.availability);
            }
          })
          .catch((err) => {
            console.error('Error fetching availability:', err);
          });
      }

      const userId = resolveCustomerUserId(user?.id);
      if (userId) {
        setFavoriteResolved(false);
        fetch(`/api/users/favorites`)
          .then(async (favoritesResponse) => {
            if (!isMounted()) return;
            if (!favoritesResponse.ok) {
              setFavoriteResolved(true);
              return;
            }
            const favoritesData = await favoritesResponse.json();
            const existingFavorite = favoritesData.favorites?.find((fav: any) => fav.serviceId === serviceId);
            if (isMounted()) {
              setIsFavorite(Boolean(existingFavorite));
              setFavoriteId(existingFavorite?.favoriteId || null);
              setFavoriteResolved(true);
            }
          })
          .catch((err) => {
            console.error('Error fetching favorites:', err);
            if (isMounted()) {
              setFavoriteResolved(true);
            }
          });
      } else {
        setIsFavorite(false);
        setFavoriteId(null);
        setFavoriteResolved(true);
      }
    } catch (err) {
      if (!isMounted()) return;
      const message =
        (err as { name?: string })?.name === 'AbortError'
          ? 'Service details took too long to load. Please retry.'
          : err instanceof Error
            ? err.message
            : 'An error occurred';
      setError(message);
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  };

  // Fetch service details first; optional enrichment should not block booking.
  useEffect(() => {
    let isMounted = true;

    if (serviceId) {
      void loadServiceData(() => isMounted);
    }

    return () => {
      isMounted = false;
    };
  }, [serviceId, user?.id]);

  const handleToggleFavorite = async () => {
    if (!service) return;
    if (!isSignedIn) {
      router.push(`/auth/login?next=${encodeURIComponent(`/service/${serviceId}`)}`);
      return;
    }

    const previousIsFavorite = isFavorite;
    const previousFavoriteId = favoriteId;

    try {
      setFavoriteLoading(true);
      
      if (isFavorite) {
        setIsFavorite(false);
        setFavoriteId(null);

        // Remove from favorites
        const response = await fetch(`/api/users/favorites/${favoriteId || serviceId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          setIsFavorite(previousIsFavorite);
          setFavoriteId(previousFavoriteId);
        }
      } else {
        setIsFavorite(true);

        // Add to favorites
        const response = await fetch('/api/users/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceId,
          }),
        });
        
        if (response.ok) {
          const payload = await response.json();
          setIsFavorite(true);
          setFavoriteId(payload?.favorite?.favoriteId || null);
        } else {
          setIsFavorite(previousIsFavorite);
          setFavoriteId(previousFavoriteId);
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setIsFavorite(previousIsFavorite);
      setFavoriteId(previousFavoriteId);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: service?.name || 'Service',
        text: `Check out this ${service?.name} service by ${service?.vendor?.name}`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast notification here
    }
  };
  const resolvedBackHref = returnTo || (isSignedIn ? '/discover' : '/');
  const resolvedBackLabel = returnLabel || (isSignedIn ? 'Back to Discover' : 'Back to Home Page');
  const handleBack = () => {
    router.push(resolvedBackHref);
  };

  if (loading) {
    return <ServiceDetailLoadingState />;
  }

  if (error) {
    return (
      <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,16,38,0.08)]">
          <div className="mb-4 inline-flex rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Service page unavailable
          </div>
          <h1 className="font-display text-3xl font-semibold text-slate-950">This service page is not ready yet</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{error}</p>
          <p className="mt-2 text-sm text-slate-500">
            This usually means the public listing is having trouble loading right now, not that the service was removed. You can retry in a moment or go back to the service catalog.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => void loadServiceData(() => true)}
              className="rounded-full bg-[var(--reliance-blue)] px-6 py-2 text-white transition-colors hover:bg-[#1a58db]"
            >
              Retry
            </button>
            <button
              onClick={handleBack}
              className="rounded-full border border-gray-300 bg-white px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              {resolvedBackLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found</p>
          <button 
            onClick={handleBack}
            className="rounded-full bg-[var(--reliance-blue)] px-6 py-2 text-white transition-colors hover:bg-[#1a58db]"
          >
            {resolvedBackLabel}
          </button>
        </div>
      </div>
    );
  }

  const primaryProofVideoUrl =
    typeof service?.primaryProofVideoUrl === 'string' && service.primaryProofVideoUrl.trim()
      ? String(service.primaryProofVideoUrl)
      : null;
  const hasPrimaryProofVideo = Boolean(service?.hasPrimaryProofVideo) && Boolean(primaryProofVideoUrl);
  const vendorRating =
    typeof service?.vendor?.rating === 'number' ? service.vendor.rating : null;
  const vendorReviewCount =
    typeof service?.vendor?.reviewCount === 'number' ? service.vendor.reviewCount : 0;
  const servicePublicReviewCount =
    typeof service?.publicReviewCount === 'number' ? service.publicReviewCount : 0;
  const headerReviewCount = servicePublicReviewCount || vendorReviewCount;
  const vendorRatingLabel = vendorRating == null ? 'New' : vendorRating.toFixed(1);
  const publicVendorEmail = getPublicVendorEmail(service?.vendor?.email);
  const publicContactHref = publicVendorEmail
    ? `mailto:${publicVendorEmail}`
    : service?.vendor?.phone
    ? `tel:${service.vendor.phone}`
    : null;
  const publicContactLabel = publicVendorEmail
    ? 'Email Vendor'
    : service?.vendor?.phone
    ? 'Call Vendor'
    : null;
  const servicePrice = Number(service?.price);
  const hasPublicPrice = Number.isFinite(servicePrice) && servicePrice > 0;
  const favoriteStatusPending = isSignedIn && !favoriteResolved;
  const vendorResponseTime =
    typeof service?.vendor?.response_time === 'string' && service.vendor.response_time.trim()
      ? service.vendor.response_time.trim()
      : null;
  const serviceVideoItems: ServiceVideoItem[] = Array.isArray(service?.videoItems) && service.videoItems.length
    ? service.videoItems
    : Array.isArray(service?.videos)
      ? service.videos.map((video: string, index: number) => ({
          id: `${index}`,
          url: video,
          createdAt: null,
          stageKey: null,
          stageLabel: 'Service Video',
          isPrimaryProofVideo: Boolean(primaryProofVideoUrl && video === primaryProofVideoUrl && index === 0),
        }))
      : [];
  const orderedServiceVideoItems = [...serviceVideoItems].sort((left, right) => {
    const leftFeatured = Boolean(left.isPrimaryProofVideo);
    const rightFeatured = Boolean(right.isPrimaryProofVideo);
    if (leftFeatured !== rightFeatured) {
      return leftFeatured ? -1 : 1;
    }

    const leftTimestamp = left.createdAt ? Date.parse(left.createdAt) : NaN;
    const rightTimestamp = right.createdAt ? Date.parse(right.createdAt) : NaN;
    const leftValid = Number.isFinite(leftTimestamp);
    const rightValid = Number.isFinite(rightTimestamp);

    if (leftValid && rightValid && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    if (leftValid !== rightValid) {
      return leftValid ? -1 : 1;
    }

    return 0;
  });
  const heroVideoItem =
    orderedServiceVideoItems.find((video) => Boolean(video.isPrimaryProofVideo)) ||
    orderedServiceVideoItems[0] ||
    null;
  const heroImageUrl =
    Array.isArray(service?.images) && typeof service.images[0] === 'string' && service.images[0].trim()
      ? service.images[0]
      : null;
  const serviceImageCount = Array.isArray(service?.images) ? service.images.length : 0;
  const serviceVideoCount = orderedServiceVideoItems.length;
  const totalServiceMediaCount = serviceImageCount + serviceVideoCount;
  const photosTabLabel =
    serviceImageCount > 0 && serviceVideoCount > 0
      ? `Photos & Videos (${totalServiceMediaCount})`
      : serviceVideoCount > 0
        ? `Videos (${serviceVideoCount})`
        : `Photos (${serviceImageCount})`;
  const vendorSidebarStats = [
    vendorResponseTime
      ? { label: 'Response Time', value: vendorResponseTime }
      : { label: 'Response Time', value: 'Contact vendor' },
    service?.vendor?.isPubliclyListed ? { label: 'Reliance Listing', value: 'Public' } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/8 bg-[rgba(4,9,18,0.88)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <RelianceLogo
                href="/"
                tone="light"
                compact
                blend
                frameClassName="h-[4.8rem] w-[4.8rem]"
              />
              <button 
                onClick={handleBack}
                className="flex items-center gap-2 text-white/72 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>{resolvedBackLabel}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {isSignedIn ? (
                <button
                  type="button"
                  data-testid="service-page-favorite-toggle"
                  aria-label={
                    favoriteStatusPending
                      ? 'Checking saved status'
                      : isFavorite
                      ? 'Remove from saved services'
                      : 'Save this service'
                  }
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading || favoriteStatusPending}
                  className={`p-2 rounded-full transition-colors ${
                    isFavorite
                      ? 'bg-pink-500/16 text-pink-200'
                      : 'bg-white/8 text-white/64 hover:bg-pink-500/16 hover:text-pink-200'
                  } ${favoriteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              ) : (
                <Link
                  href={`/auth/login?next=${encodeURIComponent(`/service/${serviceId}`)}`}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white/84 transition-colors hover:bg-white/12 hover:text-white"
                >
                  Sign in to save
                </Link>
              )}
              <button 
                onClick={handleShare}
                className="p-2 rounded-full bg-white/8 text-white/64 transition-colors hover:bg-[rgba(36,107,255,0.18)] hover:text-white"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Service Images */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-6">
              <div className="relative">
                {heroVideoItem ? (
                  <LazyVideoFrame
                    src={heroVideoItem.url}
                    title={service.name}
                    buttonLabel={heroVideoItem.isPrimaryProofVideo ? 'Play featured service video' : 'Play service video'}
                    className="h-96 w-full object-cover"
                  />
                ) : (
                  <ServiceImage
                    src={heroImageUrl}
                    alt={service.name}
                    title={service.name}
                    className="h-96 w-full object-cover"
                    fallbackClassName="h-96 w-full"
                  />
                )}
                {isSignedIn && service.original_price && service.price < service.original_price && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {Math.round(((service.original_price - service.price) / service.original_price) * 100)}% OFF
                    </div>
                  </div>
                )}
                {heroVideoItem ? (
                  <div className="absolute bottom-4 left-4">
                    <div className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                      {heroVideoItem.isPrimaryProofVideo ? 'Verified Service Video' : 'Service Video'}
                    </div>
                  </div>
                ) : null}
                {service.socialProof && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      {service.socialProof.bookingsToday} booked today
                    </div>
                  </div>
                )}
              </div>
              
              {((service.images && service.images.length > 0) || serviceVideoCount > 0) && (
                <div className="border-t border-slate-100 p-5">
                  <div className="reliance-light-card rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Service media</p>
                          <p className="text-sm text-slate-700">
                            Browse one gallery for service photos and approved service videos below. The featured completed-service clip stays highlighted here, and the remaining videos appear from newest to oldest in the Videos tab.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                            {totalServiceMediaCount} media item{totalServiceMediaCount === 1 ? '' : 's'}
                          </span>
                          {serviceImageCount > 0 ? (
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                              {serviceImageCount} photo{serviceImageCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                          {serviceVideoCount > 0 ? (
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                              {serviceVideoCount} service video{serviceVideoCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                          {hasPrimaryProofVideo ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 shadow-sm">
                              Featured completed-service video
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 shadow-sm">
                              Featured completed-service video coming soon
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {serviceVideoCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('photos');
                              setMediaFilter('videos');
                            }}
                            className="rounded-full bg-[var(--reliance-blue)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
                          >
                            Open Videos
                          </button>
                        ) : null}
                        {serviceImageCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('photos');
                              setMediaFilter('images');
                            }}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"
                          >
                            Open Photos
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Service Information */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              <div className="mb-5 flex justify-end">
                <TutorialEntryPoint guide={tutorialGuides.serviceDetail} surface="light" />
              </div>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{vendorRatingLabel}</span>
                      <span>
                        ({headerReviewCount} public review{headerReviewCount === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{service.vendor?.location || 'Location not available'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration || 'Duration not specified'}</span>
                    </div>
                  </div>
                </div>
                
                {isSignedIn ? (
                  <div className="text-right">
                    {hasPublicPrice ? (
                      <div className="text-3xl font-bold text-[var(--reliance-blue)]">${servicePrice}</div>
                    ) : (
                      <div className="max-w-40 text-sm font-semibold text-blue-700">
                        Estimate provided after review
                      </div>
                    )}
                    {hasPublicPrice && service.original_price && servicePrice < service.original_price && (
                      <>
                        <div className="text-lg text-gray-500 line-through">${service.original_price}</div>
                        <div className="text-sm text-green-600 font-medium">Save ${service.original_price - servicePrice}</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-blue-900">Public service listing</div>
                    <div className="text-xs text-blue-700">
                      {vendorReviewCount} public review{vendorReviewCount === 1 ? '' : 's'} available
                    </div>
                  </div>
                )}
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {service.description}
              </p>

              {/* Features */}
              {service.inclusions && service.inclusions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Included</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {service.inclusions.map((item: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              {service.features && service.features.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.features.map((feature: string, index: number) => (
                      <span 
                        key={index}
                        className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview', icon: null },
                    { id: 'reviews', label: `Reviews (${reviews.length || servicePublicReviewCount})`, icon: null },
                    { id: 'photos', label: photosTabLabel, icon: null }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-[var(--reliance-blue)] text-[var(--reliance-blue)]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Service</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
                    {reviews.length > 0 ? (
                      <div className="space-y-6">
                        {reviews.map((review) => (
                          <div key={review.reviewId} className="border-b border-gray-200 pb-6 last:border-b-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400">
                                  <span className="text-white font-semibold text-sm">
                                    {String(review.reviewerDisplayName || 'Verified Customer')
                                      .split(' ')
                                      .map((n: string) => n[0])
                                      .join('') || 'VC'}
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">
                                      {review.reviewerDisplayName || 'Verified Customer'}
                                    </span>
                                    <span className="text-blue-500 text-xs">Public approved</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                      />
                                    ))}
                                    <span className="text-sm text-gray-500 ml-2">
                                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Recently'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ReportContentDialog
                                targetType="review"
                                targetId={String(review.reviewId || '')}
                                isSignedIn={isSignedIn}
                                userId={resolveCustomerUserId(user?.id)}
                                triggerLabel={isSignedIn ? 'Report' : 'Sign in to report'}
                                title="Report this review"
                                description="Tell us if this review seems inappropriate, unsafe, or misleading."
                                signInHref={`/auth/login?next=${encodeURIComponent(`/service/${serviceId}`)}`}
                                className="text-xs font-medium text-gray-500 underline-offset-4 hover:text-red-700 hover:underline"
                              />
                            </div>
                            <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">
                          No approved public reviews are available for this service yet.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'photos' && (
                  <div>
                    <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                      {hasPrimaryProofVideo ? (
                        <p className="text-emerald-900">
                          Featured completed-service video stays highlighted first. Remaining approved service videos are ordered from newest to oldest.
                        </p>
                      ) : (
                        <p className="text-amber-900">
                          No featured completed-service video is available yet. Approved service videos still appear below in gallery order.
                        </p>
                      )}
                    </div>
                    {/* Media Filter for Photos Tab */}
                    <div className="flex gap-2 mb-6">
                      <button
                        onClick={() => setMediaFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mediaFilter === 'all' 
                            ? 'bg-[var(--reliance-blue)] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        All Media ({totalServiceMediaCount})
                      </button>
                      {serviceImageCount > 0 ? (
                        <button
                          onClick={() => setMediaFilter('images')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            mediaFilter === 'images' 
                              ? 'bg-[var(--reliance-blue)] text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Photos ({serviceImageCount})
                        </button>
                      ) : null}
                      {serviceVideoCount > 0 ? (
                        <button
                          onClick={() => setMediaFilter('videos')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            mediaFilter === 'videos' 
                              ? 'bg-[var(--reliance-blue)] text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Videos ({serviceVideoCount})
                        </button>
                      ) : null}
                    </div>
                    {serviceVideoCount > 0 ? (
                      <p className="mb-4 text-sm text-slate-600">
                        Service videos are labeled by stage so customers can quickly tell whether they are watching the before-service, during-service, or completed-service portion of the job.
                      </p>
                    ) : null}
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Images */}
                      {mediaFilter !== 'videos' && service.images?.map((image: string, index: number) => (
                        <div key={`photo-${index}`} className="relative group">
                          <img 
                            src={image} 
                            alt={`${service.name} photo ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                            Photo
                          </div>
                        </div>
                      ))}
                      
                      {/* Videos */}
                      {mediaFilter !== 'images' && orderedServiceVideoItems.map((video, index: number) => (
                        <div key={`video-${video.id || index}`} className="relative group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                          <LazyVideoFrame
                            src={video.url}
                            title={`${service.name} ${video.stageLabel || 'service video'} ${index + 1}`}
                            className="w-full h-48 object-cover"
                            buttonLabel="Play service video"
                            muted
                          />
                          <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                            {video.isPrimaryProofVideo ? 'Featured video' : (video.stageLabel || 'Service Video')}
                          </div>
                          <div className="space-y-1 px-3 py-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {video.isPrimaryProofVideo
                                ? 'Featured completed-service video'
                                : (video.stageLabel || 'Service Video')}
                            </p>
                            {formatMediaTimestamp(video.createdAt) ? (
                              <p className="text-xs text-slate-500">
                                Published {formatMediaTimestamp(video.createdAt)}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">
                                Approved public service video
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Booking Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24 mb-6">
              <div className="text-center mb-6">
                {isSignedIn ? (
                  <>
                    <div className="mb-1 text-3xl font-bold text-[var(--reliance-blue)]">${service.price}</div>
                    {service.original_price && service.price < service.original_price && (
                      <>
                        <div className="text-lg text-gray-500 line-through">${service.original_price}</div>
                        <div className="text-sm text-green-600 font-medium">Save ${service.original_price - service.price}</div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-xl font-bold text-gray-900 mb-2">Review this service before you book</div>
                    <p className="text-sm text-gray-600">
                      Review completed work, public feedback, and vendor details before signing in to book.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Availability: {availability?.next_available ? new Date(availability.next_available).toLocaleDateString() : 'Check with vendor'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TimeIcon className="w-4 h-4" />
                  <span>{availability?.schedule ? 'Check the schedule for details' : 'Ask the vendor about hours'}</span>
                </div>
              </div>

              <Link
                href={isSignedIn ? `/booking/${serviceId}` : `/auth/login?next=${encodeURIComponent(`/booking/${serviceId}`)}`}
                className="mb-4 block w-full rounded-xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] py-3 text-center font-semibold text-white transition-all duration-200 hover:brightness-110"
              >
                {isSignedIn ? 'Book Now' : 'Sign in to Book'}
              </Link>

              {!isSignedIn ? (
                <p className="text-xs text-gray-500 text-center mb-4">
                  Create or sign in to a free customer account before booking or saving this service.
                </p>
              ) : null}

              {publicContactHref && publicContactLabel ? (
                <a
                  href={publicContactHref}
                  className="block w-full rounded-xl bg-gray-100 py-3 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {publicContactLabel}
                </a>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                  Public contact details are not available yet for this vendor.
                </p>
              )}
            </div>

            {/* Vendor Card */}
            {service.vendor && (
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400">
                    <span className="text-white font-semibold text-lg">
                      {service.vendor.name?.split(' ').map((n: string) => n[0]).join('') || 'V'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.vendor.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">
                        {vendorRatingLabel} ({vendorReviewCount})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{service.vendor.location || 'Location not available'}</span>
                  </div>
                  {service.vendor.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{service.vendor.phone}</span>
                    </div>
                  )}
                  {publicVendorEmail && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{publicVendorEmail}</span>
                    </div>
                  )}
                </div>

                {vendorSidebarStats.length ? (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {vendorSidebarStats.map((item) => (
                        <div key={item.label}>
                          <div className="text-gray-500">{item.label}</div>
                          <div className="font-medium">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="hidden">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Response Time</div>
                      <div className="font-medium">{service.vendor.response_time || 'Contact vendor'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total Jobs</div>
                      <div className="font-medium">{service.vendor.total_jobs || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Years in Business</div>
                      <div className="font-medium">{service.vendor.years_in_business || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Verified</div>
                      <div className="font-medium text-green-600">{service.vendor.verified ? 'Verified' : 'Not verified'}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {service.vendor.insurance && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Insured
                    </span>
                  )}
                  {service.vendor.bonded && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Bonded
                    </span>
                  )}
                </div>
              </div>
            )}

            {service.vendor?.id ? (
              <div className="mb-6">
                <TrustScoreEducationCard className="mb-4" />
                <PublicTrustScorePanel
                  vendorId={service.vendor.id}
                  customerRating={vendorRating}
                  customerReviewCount={vendorReviewCount}
                  compact
                />
              </div>
            ) : null}

            {/* Social Proof */}
            {service.socialProof && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Popular in your area</span>
                </div>
                <div className="text-sm text-green-600">
                  {service.socialProof.bookingsToday} people in {service.socialProof.area} booked this {service.socialProof.timeFrame}
                </div>
                {service.socialProof.peopleLikeYou && (
                  <div className="text-sm text-green-600 mt-1">
                    {service.socialProof.peopleLikeYou} people like you also viewed this service
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <PublicSiteFooter />
    </div>
  );
}

function ServiceDetailPageFallback() {
  return <ServiceDetailLoadingState />;
}

export default function ServiceDetailPage() {
  return (
    <Suspense fallback={<ServiceDetailPageFallback />}>
      <ServiceDetailPageContent />
    </Suspense>
  );
}
