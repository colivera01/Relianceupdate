'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, RefreshCw } from 'lucide-react';
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
  if (stage === 'before') return 'Before Service';
  if (stage === 'during') return 'During Service';
  if (stage === 'after') return 'After Service (Completed Proof)';
  return 'Service Proof';
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
            <h1 className="text-2xl font-bold text-gray-900">Proof of Completed Work</h1>
            <p className="text-sm text-gray-600">Review approved media shared for this specific booking.</p>
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
          <div className="space-y-1">
            <p className="text-lg font-semibold text-gray-900">{booking?.title || booking?.service?.name || 'Service booking'}</p>
            <p className="text-sm text-gray-600">Vendor: {vendorName}</p>
            <p className="text-sm text-gray-600">Booking status: {normalizeStatus(booking?.status)}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>Service date: {booking?.booking_date || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>Service time: {booking?.booking_time || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {proofReadyFromLink ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Your service proof is ready.
          </div>
        ) : null}

        {activeVideo && activeVideo.downloadUrl ? (
          <div
            id="proof-of-completed-work"
            className={`rounded-lg border bg-white p-4 space-y-2 ${
              proofReadyFromLink ? 'ring-2 ring-emerald-200 border-emerald-300' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">Completed Service Proof</p>
              {(activeVideo.proofStage === 'after' || activeVideo.isPrimaryProofVideo) ? (
                <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                  Primary proof
                </span>
              ) : null}
              {proofReadyFromLink ? (
                <Badge className="bg-emerald-100 text-emerald-800">Proof ready</Badge>
              ) : null}
            </div>
            <p className="text-xs font-medium text-blue-800">{stageLabel(activeVideo.proofStage)}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'before' as const,
                  title: 'Before Service',
                  subtitle: 'Intro / condition overview',
                },
                {
                  key: 'during' as const,
                  title: 'During Service',
                  subtitle: 'Work in progress',
                },
                {
                  key: 'after' as const,
                  title: 'After Service',
                  subtitle: 'Completed proof',
                },
              ].map((stage) => {
                const stageVideo = timelineVideos[stage.key];
                const isActive = Boolean(stageVideo && stageVideo.id === activeVideoId);
                const isClickable = Boolean(stageVideo);
                return (
                  <button
                    key={stage.key}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => {
                      if (!stageVideo) return;
                      setActiveVideoId(stageVideo.id);
                    }}
                    className={`w-full rounded border p-3 text-left transition ${
                      isActive ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
                    } ${isClickable ? 'hover:border-blue-300 hover:bg-blue-50/40' : 'cursor-not-allowed opacity-70'}`}
                    aria-label={isClickable ? `View ${stage.title}` : `${stage.title} not shared`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{stage.title}</p>
                    <p className="text-xs text-gray-600">{stage.subtitle}</p>
                    {stageVideo ? (
                      <p className={`mt-3 text-xs font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
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

        {nonStageAdditionalMedia.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900">Additional approved shared media</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nonStageAdditionalMedia.map((asset) => {
                const isImage = String(asset.mimeType || '').startsWith('image/');
                return (
                  <div key={asset.id} className="rounded border p-2 space-y-2">
                    <p className="text-xs font-medium text-gray-900">{asset.title || 'Shared media'}</p>
                    {isImage && asset.blobUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.blobUrl} alt={asset.title || 'Shared media image'} className="w-full h-48 object-cover rounded border" />
                    ) : (
                      <p className="text-xs text-gray-600">Media preview unavailable for this file type.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
          {activeVideo && activeVideo.downloadUrl ? (
            <p>While watching the proof video, you may be prompted to leave a review or share quick feedback.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-500">
                Leave a Review
              </button>
              <button type="button" disabled className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-500">
                Share Feedback
              </button>
              <span className="text-xs text-gray-500">Review actions appear when a playable proof video is available.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
