'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, RefreshCw, Star } from 'lucide-react';
import { SmartVideoPlayer } from '@/components/reviews/SmartVideoPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { Badge } from '@/components/ui/badge';

type BookingDetail = {
  id: string;
  title: string | null;
  status: string | null;
  booking_date: string | null;
  booking_time: string | null;
  notes?: string | null;
  service?: { id?: string | null; name?: string | null } | null;
  vendor?: { id?: string | null; name?: string | null; business_name?: string | null; businessName?: string | null } | null;
};

type BookingMediaAsset = {
  id: string;
  title: string;
  type?: string;
  moderationStatus?: string;
  visibilityStatus?: string;
  downloadUrl?: string | null;
  blobUrl: string | null;
  mimeType: string;
  bytes?: string;
  mediaSessionId: string | null;
  proofStage?: 'before' | 'during' | 'after' | null;
  isPrimaryProofVideo?: boolean;
  createdAt?: string | null;
};

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return String(status)
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stageLabel(stage: 'before' | 'during' | 'after' | null | undefined): string {
  if (stage === 'before') return 'Before / INTRO';
  if (stage === 'during') return 'During / IN_PROGRESS';
  if (stage === 'after') return 'Completed / COMPLETED';
  return 'Proof Stage';
}

function formatServiceDate(dateValue: string | null | undefined): string {
  if (!dateValue) return 'Date pending';
  const asDate = new Date(dateValue);
  if (Number.isNaN(asDate.getTime())) return dateValue;
  return asDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BookingMediaDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = String(params?.bookingId || '').trim();
  const consentAcceptedFromReturn = searchParams?.get('consentAccepted') === '1';
  const proofReadyFromLink = searchParams?.get('proofReady') === '1';
  const consentTokenFromReturn = String(searchParams?.get('consentToken') || '').trim();
  const consentedMediaSessionId = String(searchParams?.get('mediaSessionId') || '').trim();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [assets, setAssets] = useState<BookingMediaAsset[]>([]);
  const [videos, setVideos] = useState<BookingMediaAsset[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState<'idle' | 'checking' | 'granted' | 'required' | 'requesting'>('idle');
  const [consentError, setConsentError] = useState<string | null>(null);
  const [hasStageInteraction, setHasStageInteraction] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewWindowId, setReviewWindowId] = useState<string | null>(null);
  const [reviewWindowMediaSessionId, setReviewWindowMediaSessionId] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewStatusMessage, setReviewStatusMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const userId = resolveCustomerUserId(user?.id);
  const bypassConsent = process.env.NEXT_PUBLIC_BYPASS_CONSENT === 'true';

  const loadPage = async () => {
    if (!bookingId) {
      setLoading(false);
      setError('Booking not found.');
      return;
    }
    if (!userId) {
      setLoading(false);
      setError('Unauthorized. Sign in to view this booking.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = { 'x-user-id': userId };
      const [bookingRes, mediaRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`, {
          method: 'GET',
          headers,
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`/api/bookings/${bookingId}/media`, {
          method: 'GET',
          headers,
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);

      const bookingJson = await bookingRes.json().catch(() => ({}));
      if (!bookingRes.ok) {
        throw new Error(bookingJson?.error || `Failed to load booking (${bookingRes.status})`);
      }
      const mediaJson = await mediaRes.json().catch(() => ({}));
      if (!mediaRes.ok) {
        throw new Error(mediaJson?.error || `Failed to load booking media (${mediaRes.status})`);
      }

      const nextBooking = (bookingJson?.booking || null) as BookingDetail | null;
      const nextAssets = Array.isArray(mediaJson?.assets) ? (mediaJson.assets as BookingMediaAsset[]) : [];
      const nextVideos = Array.isArray(mediaJson?.videos) ? (mediaJson.videos as BookingMediaAsset[]) : [];

      setBooking(nextBooking);
      setAssets(nextAssets);
      setVideos(nextVideos);

      const approvedPlayableVideos = nextAssets.filter(
        (asset) =>
          String(asset.type || '').toLowerCase() === 'video' &&
          String(asset.moderationStatus || '').toLowerCase() === 'approved' &&
          Boolean(String(asset.downloadUrl || '').trim())
      );
      const completedStagePrimary = approvedPlayableVideos.find((asset) => asset.proofStage === 'after');
      const selectedPrimary = completedStagePrimary || approvedPlayableVideos[0] || null;
      setActiveVideoId(selectedPrimary?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load booking details');
      setBooking(null);
      setAssets([]);
      setVideos([]);
      setActiveVideoId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, bookingId, userId]);

  const approvedVideos = useMemo(
    () =>
      assets.filter(
        (asset) =>
          String(asset.type || '').toLowerCase() === 'video' &&
          String(asset.moderationStatus || '').toLowerCase() === 'approved'
      ),
    [assets]
  );

  const playableVideos = useMemo(
    () =>
      approvedVideos.filter(
        (asset) =>
          Boolean(String(asset.downloadUrl || '').trim())
      ),
    [approvedVideos]
  );

  const activeVideo = useMemo(() => {
    if (playableVideos.length === 0) return null;
    return playableVideos.find((video) => video.id === activeVideoId) || playableVideos[0];
  }, [activeVideoId, playableVideos]);
  const timelineVideos = useMemo(() => {
    const byStage: Record<'before' | 'during' | 'after', BookingMediaAsset | null> = {
      before: null,
      during: null,
      after: null,
    };
    for (const video of playableVideos) {
      const stage = video.proofStage;
      if (!stage || !['before', 'during', 'after'].includes(stage)) continue;
      if (!byStage[stage]) byStage[stage] = video;
    }
    return byStage;
  }, [playableVideos]);
  const activeStage = activeVideo?.proofStage || null;

  const additionalMedia = useMemo(() => assets.filter((asset) => asset.id !== activeVideo?.id), [assets, activeVideo?.id]);
  const nonStageAdditionalMedia = useMemo(
    () => additionalMedia.filter((asset) => !asset.proofStage || !['before', 'during', 'after'].includes(asset.proofStage)),
    [additionalMedia]
  );
  const vendorName = booking?.vendor?.business_name || booking?.vendor?.businessName || booking?.vendor?.name || 'Vendor';
  const canUseReviewCapture = Boolean(
    booking?.status && !['CANCELLED', 'CANCELED'].includes(String(booking.status).trim().toUpperCase())
  );
  const reviewCaptureForActiveStage = Boolean(canUseReviewCapture && activeVideo?.proofStage === 'after' && activeVideo?.mediaSessionId);
  const canShowInlineReview = Boolean(
    canUseReviewCapture &&
    userId &&
    booking?.vendor?.id &&
    activeVideo?.proofStage === 'after' &&
    activeVideo?.mediaSessionId
  );

  useEffect(() => {
    if (!bookingId) return;
    const storageKey = `consent_${bookingId}`;
    const storedConsent = sessionStorage.getItem(storageKey);
    const hasConsentQueryParams = Boolean(
      consentAcceptedFromReturn || consentTokenFromReturn || consentedMediaSessionId
    );
    if (storedConsent === 'true') {
      setHasConsent(true);
      if (hasConsentQueryParams) {
        router.replace(`/my-bookings/${bookingId}`);
      }
      return;
    }
    if (consentAcceptedFromReturn) {
      setHasConsent(true);
      sessionStorage.setItem(storageKey, 'true');
      router.replace(`/my-bookings/${bookingId}`);
    }
  }, [bookingId, consentAcceptedFromReturn, consentTokenFromReturn, consentedMediaSessionId, router]);

  useEffect(() => {
    if (!proofReadyFromLink) return;
    const target = document.getElementById('proof-of-completed-work');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [proofReadyFromLink, loading, activeVideo?.id]);

  useEffect(() => {
    if (!activeVideo) {
      setConsentStatus('idle');
      setConsentError(null);
      return;
    }
    if (bypassConsent) {
      setHasConsent(true);
      setConsentStatus('granted');
      setConsentError(null);
      return;
    }
    if (!hasConsent) {
      setConsentStatus('required');
      setConsentError(null);
      return;
    }
    // Consent is booking-level for customer proof playback. Do not reset on stage switches.
    setConsentStatus('granted');
    setConsentError(null);
  }, [
    activeVideo,
    bypassConsent,
    hasConsent,
  ]);

  useEffect(() => {
    setReviewStatusMessage(null);
    setReviewError(null);
  }, [activeVideoId]);

  useEffect(() => {
    if (!canShowInlineReview || !activeVideo?.mediaSessionId || !booking?.vendor?.id || !userId) {
      setReviewWindowId(null);
      setReviewWindowMediaSessionId(null);
      return;
    }
    if (reviewWindowMediaSessionId === activeVideo.mediaSessionId && reviewWindowId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/reviews/window/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            bookingId,
            vendorId: String(booking.vendor?.id || ''),
            mediaSessionId: String(activeVideo.mediaSessionId),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.reviewWindow?.id) {
          setReviewWindowId(String(json.reviewWindow.id));
          setReviewWindowMediaSessionId(String(activeVideo.mediaSessionId));
          return;
        }
        setReviewWindowId(null);
        setReviewWindowMediaSessionId(null);
      } catch {
        if (cancelled) return;
        setReviewWindowId(null);
        setReviewWindowMediaSessionId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeVideo?.mediaSessionId,
    booking?.vendor?.id,
    bookingId,
    canShowInlineReview,
    reviewWindowId,
    reviewWindowMediaSessionId,
    userId,
  ]);

  const submitInlineReview = async () => {
    if (!canShowInlineReview || !reviewWindowId || !booking?.vendor?.id || !userId || reviewSubmitting) return;
    if (selectedRating < 1 || selectedRating > 5) {
      setReviewError('Please select a rating before submitting.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    setReviewStatusMessage(null);
    try {
      const res = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          reviewWindowId,
          bookingId,
          vendorId: String(booking.vendor.id),
          rating: selectedRating,
          comment: '',
          submittedVia: 'video_overlay',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const isReviewAlreadySubmitted =
          res.status === 409 &&
          (String(json?.code || '') === 'REVIEW_ALREADY_EXISTS' ||
            String(json?.error || '').toLowerCase().includes('review already exists') ||
            String(json?.message || '').toLowerCase().includes('review already exists'));
        if (isReviewAlreadySubmitted) {
          setReviewStatusMessage('You already submitted a review for this service.');
          return;
        }
        throw new Error(String(json?.error || json?.message || 'Failed to submit review'));
      }
      setReviewStatusMessage('Thanks for your review.');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const requestConsent = async () => {
    if (!activeVideo || !booking?.vendor?.id || !activeVideo.mediaSessionId) {
      setConsentError('Consent request is unavailable for this video.');
      return;
    }
    setConsentStatus('requesting');
    setConsentError(null);
    try {
      const res = await fetch('/api/consent/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({
          bookingId,
          vendorId: String(booking.vendor.id),
          mediaSessionId: String(activeVideo.mediaSessionId),
          consentType: 'video_access',
          origin: window.location.origin,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.consentUrl) {
        throw new Error(json?.error || json?.message || `Failed to request consent (${res.status})`);
      }
      const returnTo = `/my-bookings/${bookingId}`;
      const consentUrl = new URL(String(json.consentUrl), window.location.origin);
      consentUrl.searchParams.set('returnTo', returnTo);
      consentUrl.searchParams.set('mediaSessionId', String(activeVideo.mediaSessionId));
      window.location.href = `${consentUrl.pathname}${consentUrl.search}${consentUrl.hash}`;
    } catch (e) {
      setConsentStatus('required');
      setConsentError(e instanceof Error ? e.message : 'Failed to request consent');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="rounded border bg-white px-4 py-8 text-sm text-gray-600 text-center">Loading booking proof…</div>
        </div>
      </div>
    );
  }

  if (error) {
    const maybeUnauthorized = /unauthorized|forbidden|sign in/i.test(error);
    const maybeNotFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-3">
          <div className="rounded border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{error}</div>
          <div className="text-sm text-gray-700">
            {maybeUnauthorized ? (
              <Link href="/auth/login" className="text-blue-700 underline font-medium">
                Sign in to continue
              </Link>
            ) : maybeNotFound ? (
              <Link href="/my-bookings" className="text-blue-700 underline font-medium">
                Back to My Services
              </Link>
            ) : (
              <button type="button" onClick={() => void loadPage()} className="text-blue-700 underline font-medium">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">{booking?.service?.name || booking?.title || 'Service booking'}</h1>
            <p className="text-sm text-gray-600">Customer proof</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPage()}
              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <Link href="/my-bookings" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
              Back to My Services
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">{vendorName}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {normalizeStatus(booking?.status)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  {formatServiceDate(booking?.booking_date)}
                </span>
                {booking?.booking_time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-500" />
                    {booking.booking_time}
                  </span>
                ) : null}
              </div>
            </div>
            {proofReadyFromLink ? <Badge className="bg-emerald-100 text-emerald-800">Proof ready</Badge> : null}
          </div>
        </div>

        {activeVideo && activeVideo.downloadUrl ? (
          <div
            id="proof-of-completed-work"
            className={`rounded-lg border bg-white p-4 space-y-2 ${
              proofReadyFromLink ? 'ring-2 ring-emerald-200 border-emerald-300' : ''
            }`}
          >
            <p className="text-xs font-medium tracking-wide text-gray-600">{stageLabel(activeVideo.proofStage)}</p>
            {bypassConsent ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Consent will be required in production before accessing video.
              </div>
            ) : null}
            {bypassConsent || hasConsent ? (
              <SmartVideoPlayer
                src={activeVideo.downloadUrl}
                bookingId={bookingId}
                vendorId={String(booking?.vendor?.id || '')}
                mediaSessionId={activeVideo.mediaSessionId || activeVideo.id}
                reviewCaptureEnabled={reviewCaptureForActiveStage}
                userId={userId ?? undefined}
                className="w-full max-w-full"
              />
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-3">
                <p>You must accept video access before viewing this service proof.</p>
                <button
                  type="button"
                  onClick={() => void requestConsent()}
                  disabled={consentStatus === 'checking' || consentStatus === 'requesting'}
                  className="rounded bg-blue-600 px-3 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {consentStatus === 'requesting' ? 'Preparing consent...' : 'Review & Accept Access'}
                </button>
                {consentStatus === 'checking' ? <p className="text-xs text-amber-800">Checking consent status…</p> : null}
                {consentError ? <p className="text-xs text-red-700">{consentError}</p> : null}
              </div>
            )}
            <div className="space-y-0.5 pt-1">
              <p className="text-sm font-semibold text-gray-900">Final Result</p>
              <p className="text-sm text-gray-600">This is the completed work submitted by the provider.</p>
            </div>
          </div>
        ) : approvedVideos.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            We&apos;re preparing your service proof video. It will appear here shortly.
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            No playable proof video is available yet. Approved media may still include images or non-video files.
          </div>
        )}

        {playableVideos.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900">Service Proof Timeline</p>
            {!hasStageInteraction ? (
              <p className="text-xs text-gray-500">Tap to view each stage of the service</p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'before' as const,
                  title: 'Before',
                  subtitle: 'INTRO',
                },
                {
                  key: 'during' as const,
                  title: 'During',
                  subtitle: 'IN_PROGRESS',
                },
                {
                  key: 'after' as const,
                  title: 'Completed',
                  subtitle: 'COMPLETED',
                },
              ].map((stage) => {
                const stageVideo = timelineVideos[stage.key];
                const isActive = Boolean(stageVideo && stageVideo.id === activeVideoId);
                const isClickable = Boolean(stageVideo);
                const isFinalStage = stage.key === 'after';
                return (
                  <button
                    key={stage.key}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => {
                      if (!stageVideo) return;
                      setHasStageInteraction(true);
                      setActiveVideoId(stageVideo.id);
                    }}
                    className={`w-full rounded border p-3 text-left transition ${
                      isActive
                        ? isFinalStage
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-blue-600 bg-blue-50'
                        : isFinalStage
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-gray-200 bg-white'
                    } ${isClickable ? 'hover:border-blue-300 hover:bg-blue-50/40' : 'cursor-not-allowed opacity-70'}`}
                    aria-label={isClickable ? `View ${stage.title}` : `${stage.title} not shared`}
                  >
                    <p className={`text-sm font-semibold ${isFinalStage ? 'text-emerald-800' : 'text-gray-900'}`}>{stage.title}</p>
                    <p className={`text-xs ${isFinalStage ? 'text-emerald-700' : 'text-gray-600'}`}>{stage.subtitle}</p>
                    {stageVideo ? (
                      <p
                        className={`mt-3 text-xs font-medium ${
                          isActive ? (isFinalStage ? 'text-emerald-700' : 'text-blue-700') : 'text-gray-700'
                        }`}
                      >
                        {isActive ? 'Now Viewing' : 'View proof'}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-gray-500">Not shared</p>
                    )}
                  </button>
                );
              })}
            </div>
            {activeStage ? <p className="text-xs text-gray-500">Current stage: {stageLabel(activeStage)}</p> : null}
          </div>
        ) : null}

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Leave a review</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const selected = value <= selectedRating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRating(value)}
                  className="rounded p-1 transition hover:bg-gray-100"
                  aria-label={`Select ${value} star${value > 1 ? 's' : ''}`}
                >
                  <Star className={`h-5 w-5 ${selected ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void submitInlineReview()}
              disabled={!canShowInlineReview || !reviewWindowId || reviewSubmitting}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewSubmitting ? 'Submitting...' : 'Leave Review'}
            </button>
            {!canShowInlineReview ? (
              <span className="text-xs text-gray-500">Switch to Completed stage to submit your review.</span>
            ) : null}
            {canShowInlineReview && !reviewWindowId ? (
              <span className="text-xs text-gray-500">Preparing review session...</span>
            ) : null}
          </div>
          {reviewStatusMessage ? <p className="text-xs text-emerald-700">{reviewStatusMessage}</p> : null}
          {reviewError ? <p className="text-xs text-red-700">{reviewError}</p> : null}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-sm font-medium text-gray-900"
            aria-expanded={showDetails}
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
          {showDetails ? (
            <div className="mt-3 grid gap-2 text-sm text-gray-700">
              <p>
                <span className="font-medium text-gray-900">Service:</span> {booking?.service?.name || booking?.title || 'Service booking'}
              </p>
              <p>
                <span className="font-medium text-gray-900">Vendor:</span> {vendorName}
              </p>
              <p>
                <span className="font-medium text-gray-900">Date:</span> {formatServiceDate(booking?.booking_date)}
                {booking?.booking_time ? ` at ${booking.booking_time}` : ''}
              </p>
              <p>
                <span className="font-medium text-gray-900">Notes:</span> {booking?.notes || booking?.title || 'No additional notes.'}
              </p>
              {nonStageAdditionalMedia.length > 0 ? (
                <p className="text-xs text-gray-500">
                  Additional approved files are available for this booking ({nonStageAdditionalMedia.length}).
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
