'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, LogIn, RefreshCw, ShieldCheck, Star, UserPlus } from 'lucide-react';
import { GuidanceCallout } from '@/components/guidance/GuidanceCallout';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { SmartVideoPlayer } from '@/components/reviews/SmartVideoPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import type { CustomerBookingLifecycle } from '@/lib/customer-booking-lifecycle';
import { getCustomerReviewGateMessage } from '@/lib/customer-reviews';
import { formatDisplayTime } from '@/lib/date-display';
import {
  formatMyBookingsStatusDisplay,
  isArchivedStatus,
  isCompletedStatus,
  normalizeBookingStatusKey,
  resolveBookingScheduleInstant,
} from '@/lib/my-bookings';
import { tutorialGuides } from '@/lib/user-guidance';
import { getCustomerProofStageLabel } from '@/lib/vendor-job-video-stages';
import { Badge } from '@/components/ui/badge';
import { ReportContentDialog } from '@/components/reports/ReportContentDialog';
import { getClientSessionHeaders } from '@/lib/client-session';
import { appendAuthNext } from '@/lib/auth-next';

type BookingDetail = {
  id: string;
  title: string | null;
  status: string | null;
  booking_date: string | null;
  booking_time: string | null;
  notes?: string | null;
  service?: { id?: string | null; name?: string | null } | null;
  vendor?: { id?: string | null; name?: string | null; business_name?: string | null; businessName?: string | null } | null;
  customerReview?: {
    id: string;
    rating: number;
    comment: string;
    submittedAt: string;
  } | null;
};

type BookingLifecycleDetail = CustomerBookingLifecycle & {
  reviewSubmittedAt?: string | null;
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

type BookingClaimIssue = {
  code: string;
  message: string;
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
  return getCustomerProofStageLabel(stage);
}

function stageSummary(
  stage: 'before' | 'during' | 'after' | null | undefined,
  options?: { hasExistingReview?: boolean }
): {
  heading: string;
  description: string;
  consentPrompt: string;
} {
  const hasExistingReview = options?.hasExistingReview === true;
  if (stage === 'before') {
    return {
      heading: 'Starting Condition',
      description: 'This is the starting-condition overview your provider shared before work began.',
      consentPrompt: hasExistingReview
        ? 'This service video is available to watch, but we need your permission before playback.'
        : 'This service video is available to review, but we need your permission before playback.',
    };
  }
  if (stage === 'during') {
    return {
      heading: 'Work in Progress',
      description: 'This is the in-progress service footage shared while work was being performed.',
      consentPrompt: hasExistingReview
        ? 'This service video is available to watch, but we need your permission before playback.'
        : 'This service video is available to review, but we need your permission before playback.',
    };
  }
  return {
    heading: 'Final Result',
    description: 'This is the completed work shared by your provider.',
    consentPrompt: hasExistingReview
      ? 'This completed service video is available to watch, but we need your permission before playback.'
      : 'This service video is ready to review, but we need your permission before playback.',
  };
}

function formatServiceDate(dateValue: string | null | undefined): string {
  if (!dateValue) return 'Date pending';
  const asDate = new Date(dateValue);
  if (Number.isNaN(asDate.getTime())) return dateValue;
  return asDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function bookingStatusBadgeClass(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'COMPLETED') return 'border-green-200 bg-green-50 text-green-700';
  if (normalized === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'PENDING' || normalized === 'AWAITING_REVIEW') return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  if (normalized === 'REJECTED' || normalized === 'CANCELED' || normalized === 'CANCELLED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function parseRatingParam(value: string | null | undefined): number | null {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating;
}

function BookingMediaDetailPageContent() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = String(params?.bookingId || '').trim();
  const consentAcceptedFromReturn = searchParams?.get('consentAccepted') === '1';
  const videoReadyFromLink =
    searchParams?.get('videoReady') === '1' || searchParams?.get('proofReady') === '1';
  const claimToken = String(searchParams?.get('claimToken') || '').trim();
  const consentTokenFromReturn = String(searchParams?.get('consentToken') || '').trim();
  const consentedMediaSessionId = String(searchParams?.get('mediaSessionId') || '').trim();
  const requestedReturnTo = String(searchParams?.get('returnTo') || '').trim();
  const quickRatingFromLink = parseRatingParam(searchParams?.get('rating'));
  const cleanedDetailHref =
    requestedReturnTo === '/reviews'
      ? `/my-bookings/${bookingId}?returnTo=${encodeURIComponent('/reviews')}`
      : `/my-bookings/${bookingId}`;
  const { user, isLoading: authLoading, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimIssue, setClaimIssue] = useState<BookingClaimIssue | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [customerLifecycle, setCustomerLifecycle] = useState<BookingLifecycleDetail | null>(null);
  const [assets, setAssets] = useState<BookingMediaAsset[]>([]);
  const [videos, setVideos] = useState<BookingMediaAsset[]>([]);
  const [privateProofStatus, setPrivateProofStatus] = useState<'AVAILABLE' | 'NOT_AVAILABLE' | null>(null);
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
  const [storyMode, setStoryMode] = useState(false);
  const [storyAutoPlayToken, setStoryAutoPlayToken] = useState<number | null>(null);

  const userId = resolveCustomerUserId(user?.id);
  const bypassConsent = process.env.NEXT_PUBLIC_BYPASS_CONSENT === 'true';
  const invitationQuery = searchParams?.toString() || '';
  const invitationPath = `/my-bookings/${bookingId}${
    invitationQuery ? `?${invitationQuery}` : ''
  }`;
  const registrationHref = appendAuthNext(
    '/auth/register?type=user',
    invitationPath
  );
  const loginHref = appendAuthNext('/auth/login', invitationPath);

  const loadPage = async () => {
    if (!bookingId) {
      setLoading(false);
      setError('Service record not found.');
      return;
    }
    if (!userId) {
      setLoading(false);
      setError('Unauthorized. Sign in to view this service record.');
      return;
    }

    setLoading(true);
    setError(null);
    setClaimIssue(null);
    try {
      if (videoReadyFromLink) {
        const claimResponse = await fetch(`/api/bookings/${bookingId}/claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getClientSessionHeaders(userId),
          },
          credentials: 'include',
          body: JSON.stringify({ claimToken }),
        });
        const claimJson = await claimResponse.json().catch(() => ({}));
        if (!claimResponse.ok) {
          const claimCode = String(claimJson?.code || '').trim();
          if (
            claimCode === 'CLAIM_EMAIL_MISMATCH' ||
            claimCode === 'BOOKING_ALREADY_CLAIMED'
          ) {
            setClaimIssue({
              code: claimCode,
              message: String(
                claimJson?.error ||
                  'This service record belongs to a different customer account.'
              ),
            });
            setBooking(null);
            setCustomerLifecycle(null);
            setAssets([]);
            setVideos([]);
            setPrivateProofStatus(null);
            setActiveVideoId(null);
            return;
          }
          throw new Error(
            claimJson?.error ||
              `Unable to connect this service record (${claimResponse.status})`
          );
        }
        if (claimToken) {
          const cleanedParams = new URLSearchParams(
            searchParams?.toString() || ''
          );
          cleanedParams.delete('claimToken');
          const cleanedQuery = cleanedParams.toString();
          router.replace(
            `/my-bookings/${bookingId}${cleanedQuery ? `?${cleanedQuery}` : ''}`
          );
        }
      }

      const [bookingRes, mediaRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`/api/bookings/${bookingId}/media`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);

      const bookingJson = await bookingRes.json().catch(() => ({}));
      if (!bookingRes.ok) {
        throw new Error(bookingJson?.error || `Failed to load service record (${bookingRes.status})`);
      }
      const mediaJson = await mediaRes.json().catch(() => ({}));
      if (!mediaRes.ok) {
        throw new Error(mediaJson?.error || `Failed to load service videos (${mediaRes.status})`);
      }

      const nextBooking = (bookingJson?.booking || null) as BookingDetail | null;
      if (nextBooking) {
        nextBooking.customerReview = bookingJson?.customerReview || null;
      }
      const nextLifecycle = (bookingJson?.customerLifecycle || null) as BookingLifecycleDetail | null;
      const nextAssets = Array.isArray(mediaJson?.assets) ? (mediaJson.assets as BookingMediaAsset[]) : [];
      const nextVideos = Array.isArray(mediaJson?.videos) ? (mediaJson.videos as BookingMediaAsset[]) : [];

      setBooking(nextBooking);
      setCustomerLifecycle(nextLifecycle);
      setAssets(nextAssets);
      setVideos(nextVideos);
      setPrivateProofStatus(
        mediaJson?.privateProofStatus === 'AVAILABLE' ? 'AVAILABLE' : 'NOT_AVAILABLE'
      );

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
      setError(e instanceof Error ? e.message : 'Failed to load service record details');
      setBooking(null);
      setCustomerLifecycle(null);
      setAssets([]);
      setVideos([]);
      setPrivateProofStatus(null);
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
  const orderedStageVideos = useMemo(
    () =>
      (['before', 'during', 'after'] as const)
        .map((stage) => timelineVideos[stage])
        .filter(Boolean) as BookingMediaAsset[],
    [timelineVideos]
  );
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
  const hasReviewableCompletedVideo = Boolean(
    canUseReviewCapture &&
    userId &&
    booking?.vendor?.id &&
    timelineVideos.after?.mediaSessionId
  );
  const canShowInlineReview = Boolean(
    canUseReviewCapture &&
    userId &&
    booking?.vendor?.id &&
    activeVideo?.proofStage === 'after' &&
    activeVideo?.mediaSessionId
  );
  const existingCustomerReview = booking?.customerReview || null;
  const hasExistingCustomerReview = Boolean(existingCustomerReview?.id);
  const reviewSubmitted =
    hasExistingCustomerReview || customerLifecycle?.reviewSubmitted === true;
  const reviewEligible = customerLifecycle?.reviewEligible === true;
  const reviewSubmittedWithoutEligibleVideo =
    customerLifecycle?.reviewSubmittedWithoutEligibleVideo === true;
  const completedVideoPendingApproval =
    customerLifecycle?.videoPendingApproval === true ||
    customerLifecycle?.videoState === 'pending_approval';
  const completedVideoAvailableToCustomer =
    customerLifecycle?.videoAvailableToCustomer === true;
  const lifecycleVideoState = customerLifecycle?.videoState || null;
  const consentAllowsInlineReview = Boolean(bypassConsent || hasConsent);
  const canStartInlineReview = Boolean(canShowInlineReview && consentAllowsInlineReview && !hasExistingCustomerReview);
  const reviewGateMessage = getCustomerReviewGateMessage({
    hasReviewableCompletedVideo,
    canShowInlineReview,
    consentAllowsInlineReview: consentAllowsInlineReview && !hasExistingCustomerReview,
  });
  const normalizedBookingStatus = String(booking?.status || '').trim().toUpperCase();
  const statusKey = normalizeBookingStatusKey(booking?.status);
  const { instant: bookingScheduleInstant } = resolveBookingScheduleInstant(
    booking?.booking_date,
    booking?.booking_time,
    booking?.id || null
  );
  const archivedRecord = isArchivedStatus(statusKey);
  const completedRecord = isCompletedStatus(statusKey);
  const followUpRecord =
    !archivedRecord &&
    !completedRecord &&
    !Number.isNaN(bookingScheduleInstant.getTime()) &&
    bookingScheduleInstant.getTime() < Date.now();
  const bookingStatusDisplay = formatMyBookingsStatusDisplay(booking?.status, {
    scheduleInstant: bookingScheduleInstant,
    now: new Date(),
  });
  const proofPendingApproval =
    customerLifecycle
      ? completedVideoPendingApproval
      : (normalizedBookingStatus === 'AWAITING_REVIEW' || normalizedBookingStatus === 'IN_PROGRESS') &&
        playableVideos.length === 0 &&
        approvedVideos.length === 0;
  const bookingTimeDisplay = formatDisplayTime(booking?.booking_time) || booking?.booking_time || 'Time pending';
  const activeStageSummary = stageSummary(activeVideo?.proofStage || null, {
    hasExistingReview: hasExistingCustomerReview,
  });
  const resolvedReturnTo = requestedReturnTo === '/reviews' ? '/reviews' : '/my-bookings';
  const returnLinkLabel = resolvedReturnTo === '/reviews' ? 'Back to My Reviews' : 'Back to My Service Records';
  const awaitingApprovedReviewVideo =
    resolvedReturnTo === '/reviews' &&
    !archivedRecord &&
    !followUpRecord &&
    !hasExistingCustomerReview &&
    (customerLifecycle ? !reviewEligible : playableVideos.length === 0 && !proofPendingApproval);
  const detailReturnPath =
    resolvedReturnTo === '/reviews'
      ? `/my-bookings/${bookingId}?returnTo=${encodeURIComponent('/reviews')}`
      : `/my-bookings/${bookingId}`;
  const helpReturnLabel = resolvedReturnTo === '/reviews' ? 'Back to review detail' : 'Back to service page';
  const customerHelpHref = `/customer/support?returnTo=${encodeURIComponent(detailReturnPath)}&returnLabel=${encodeURIComponent(helpReturnLabel)}`;
  const canPlayFullStory = orderedStageVideos.length > 1;
  const completedWithoutCustomerVisibleVideo =
    completedRecord &&
    (customerLifecycle
      ? !completedVideoAvailableToCustomer && !completedVideoPendingApproval
      : playableVideos.length === 0 && !proofPendingApproval);
  const existingReviewSupportMessage = archivedRecord
    ? 'This archived record no longer includes customer-visible media, but your review remains on file.'
    : playableVideos.length > 0
      ? 'You can still approve video access to rewatch the completed service, but this service record does not need another review submission.'
      : completedWithoutCustomerVisibleVideo
        ? 'Your review remains on file for this completed service record, but no customer-visible approved service video is currently available here.'
        : 'Your review is already on file for this service record. No additional review submission is needed.';
  const lifecycleRows =
    completedRecord && customerLifecycle
      ? [
          { label: 'Vendor completed work', value: 'Yes' },
          {
            label: 'Completed-stage video submitted',
            value: customerLifecycle.videoSubmitted ? 'Yes' : 'No',
          },
          {
            label: 'Completed-stage video approval',
            value: completedVideoAvailableToCustomer
              ? 'Approved'
              : completedVideoPendingApproval
                ? 'Pending approval'
                : lifecycleVideoState === 'approved_not_customer_visible'
                  ? 'Approved, not customer-visible'
                  : lifecycleVideoState === 'rejected'
                    ? 'Rejected / not customer-visible'
                    : 'Not submitted',
          },
          {
            label: 'Customer video access',
            value: completedVideoAvailableToCustomer ? 'Available' : 'Not available',
          },
          {
            label: 'Optional review',
            value: reviewSubmitted
              ? 'Submitted'
              : reviewEligible
                ? 'Available when you are ready'
                : 'Available after approved video delivery',
          },
          {
            label: 'Review',
            value: reviewSubmitted ? 'Submitted' : reviewEligible ? 'Ready when you are' : 'Not open yet',
          },
        ]
      : [];
  const lifecycleGuidance =
    reviewSubmittedWithoutEligibleVideo || (reviewSubmitted && completedWithoutCustomerVisibleVideo)
      ? {
          title: 'Why this service record shows a submitted review without a playable video',
          description:
            'This service record has a real submitted review on file, but a customer-visible approved final-result video is not attached right now.',
          bullets: [
            'Completed work, video availability, and review history are tracked separately.',
            'Your earlier review remains on file even though this service record does not currently expose a customer-visible final-result video.',
            'If you expected a playable service video here, use the Help Center with the reference ID below.',
          ],
          tone: 'slate' as const,
        }
      : completedVideoPendingApproval
        ? {
          title: 'Why the service video is not open yet',
          description:
              'The vendor completed the work and submitted the final-result video, but Reliance still has to finish approval before customer playback can open here.',
            bullets: [
              'Work completion does not automatically make the service video customer-visible.',
              'Review eligibility opens only after an approved final-result customer-visible video is available.',
              "You'll be able to watch the video from this page once approval is complete.",
            ],
            tone: 'amber' as const,
          }
        : awaitingApprovedReviewVideo
          ? {
              title: 'Why an optional review is not available yet',
              description:
                'Reviews unlock only after an approved final-result customer-visible video exists for this service record.',
              bullets: [
                'A completed service record can still be waiting on moderation or customer visibility.',
                'If a video was rejected or kept non-customer-visible, the review flow stays closed.',
                'Open Help if you expected a playable final-result video already.',
              ],
              tone: 'amber' as const,
            }
          : completedWithoutCustomerVisibleVideo
            ? {
                title: 'Why this completed service record does not show a customer-visible video',
                description:
                  'The service record is marked completed, but no approved final-result video is customer-visible right now.',
                bullets: [
                  'Completed work, approved video, customer access, and review timing are separate lifecycle steps.',
                  'This can happen when a video was not submitted, is private, or is not customer-visible.',
                  'The page will open playback and review tools only when the correct approved customer-visible video exists.',
                ],
                tone: 'slate' as const,
              }
            : null;

  const startFullStoryPlayback = () => {
    if (orderedStageVideos.length === 0) return;
    setStoryMode(true);
    setHasStageInteraction(true);
    setActiveVideoId(orderedStageVideos[0].id);
    setStoryAutoPlayToken(Date.now());
  };

  const stopFullStoryPlayback = () => {
    setStoryMode(false);
    setStoryAutoPlayToken(null);
  };

  const handleStoryStageEnded = () => {
    if (!storyMode || !activeVideo) return;
    const currentIndex = orderedStageVideos.findIndex((video) => video.id === activeVideo.id);
    if (currentIndex < 0) {
      setStoryMode(false);
      setStoryAutoPlayToken(null);
      return;
    }
    const nextVideo = orderedStageVideos[currentIndex + 1];
    if (!nextVideo) {
      setStoryMode(false);
      setStoryAutoPlayToken(null);
      return;
    }
    setActiveVideoId(nextVideo.id);
    setStoryAutoPlayToken(Date.now());
  };

  const nextStoryStageLabel = useMemo(() => {
    if (!storyMode || !activeVideo) return null;
    const currentIndex = orderedStageVideos.findIndex((video) => video.id === activeVideo.id);
    const nextVideo = currentIndex >= 0 ? orderedStageVideos[currentIndex + 1] : null;
    return nextVideo ? stageLabel(nextVideo.proofStage) : null;
  }, [activeVideo, orderedStageVideos, storyMode]);

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
        router.replace(cleanedDetailHref);
      }
      return;
    }
    if (consentAcceptedFromReturn) {
      setHasConsent(true);
      sessionStorage.setItem(storageKey, 'true');
      router.replace(cleanedDetailHref);
    }
  }, [bookingId, cleanedDetailHref, consentAcceptedFromReturn, consentTokenFromReturn, consentedMediaSessionId, router]);

  useEffect(() => {
    if (!videoReadyFromLink) return;
    const target = document.getElementById('completed-service-video');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [videoReadyFromLink, loading, activeVideo?.id]);

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
    if (!quickRatingFromLink || hasExistingCustomerReview) return;
    setSelectedRating(quickRatingFromLink);
  }, [hasExistingCustomerReview, quickRatingFromLink]);

  useEffect(() => {
    if (!canStartInlineReview || !activeVideo?.mediaSessionId || !booking?.vendor?.id || !userId) {
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
    canStartInlineReview,
    reviewWindowId,
    reviewWindowMediaSessionId,
    userId,
  ]);

  const submitInlineReview = async () => {
    if (!canStartInlineReview || !reviewWindowId || !booking?.vendor?.id || !userId || reviewSubmitting) return;
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
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/consent/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          bookingId,
          vendorId: String(booking.vendor.id),
          mediaSessionId: String(activeVideo.mediaSessionId),
          consentType: 'video_access',
          origin: window.location.origin,
          skipNotification: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.consentUrl) {
        throw new Error(json?.error || json?.message || `Failed to request consent (${res.status})`);
      }
      const returnTo = detailReturnPath;
      const consentUrl = new URL(String(json.consentUrl), window.location.origin);
      consentUrl.searchParams.set('returnTo', returnTo);
      consentUrl.searchParams.set('mediaSessionId', String(activeVideo.mediaSessionId));
      window.location.href = `${consentUrl.pathname}${consentUrl.search}${consentUrl.hash}`;
    } catch (e) {
      setConsentStatus('required');
      const message =
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Request timed out while preparing consent. Please try again.'
          : e instanceof Error
            ? e.message
            : 'Failed to request consent';
      setConsentError(message);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-900">Loading service record details...</p>
              <p className="text-xs text-blue-800">Fetching service videos, timeline stages, and customer review tools.</p>
            </div>
            <div className="h-5 w-44 rounded bg-gray-200 animate-pulse" />
            <div className="h-56 w-full rounded bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="h-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-24 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (claimIssue) {
    return (
      <div className="min-h-[68vh] px-4 py-10">
        <div className="mx-auto flex min-h-[58vh] w-full max-w-2xl items-center justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-video-account-title"
            className="w-full rounded-[28px] border border-white/10 bg-slate-950/88 p-7 text-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:p-9"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
              Customer account protection
            </p>
            <h1
              id="service-video-account-title"
              className="mt-2 text-3xl font-semibold text-white"
            >
              This video was shared with another customer email
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              You are currently signed in as {user?.email}. To protect the
              completed work order, Reliance can only connect it to the customer
              email that received the service-video link.
            </p>
            <div className="mt-5 rounded-xl border border-blue-300/20 bg-blue-500/10 px-5 py-4 text-sm leading-6 text-slate-200">
              <p className="font-semibold text-white">
                Continue with the email that received this link.
              </p>
              <p className="mt-1">
                Customer registration is free. After registration or sign-in,
                this work order will open and be saved in My Service Records.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void logout(registrationHref)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                <UserPlus className="h-4 w-4" />
                Switch Account and Register Free
              </button>
              <button
                type="button"
                onClick={() => void logout(loginHref)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <LogIn className="h-4 w-4" />
                Switch Account and Sign In
              </button>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">
              Reference ID: <span className="font-mono">{bookingId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const maybeUnauthorized = /unauthorized|forbidden|sign in/i.test(error);
    const maybeNotFound = /not found/i.test(error);
    const maybeTemporarilyUnavailable = /temporarily unavailable|cannot reach the service database/i.test(error);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-3">
          <div className="rounded border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
            {maybeTemporarilyUnavailable
              ? 'Service videos are temporarily unavailable right now.'
              : "We couldn't load this service video page."}
          </div>
          {maybeTemporarilyUnavailable ? (
            <p className="text-sm text-gray-700">
              Reliance is having trouble reaching the service database. Please try again in a moment.
            </p>
          ) : null}
          {bookingId ? (
            <p className="text-xs text-gray-500">
              Reference ID: <span className="font-mono">{bookingId}</span>
            </p>
          ) : null}
          <div className="text-sm text-gray-700">
            {maybeUnauthorized ? (
              <Link href="/auth/login" className="text-blue-700 underline font-medium">
                Sign in to continue
              </Link>
            ) : maybeNotFound ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link href={resolvedReturnTo} className="text-blue-700 underline font-medium">
                  {returnLinkLabel}
                </Link>
                <Link href={customerHelpHref} className="text-blue-700 underline font-medium">
                  Open Help Center
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void loadPage()} className="text-blue-700 underline font-medium">
                  Try again
                </button>
                <Link href={resolvedReturnTo} className="text-blue-700 underline font-medium">
                  {returnLinkLabel}
                </Link>
                <Link href={customerHelpHref} className="text-blue-700 underline font-medium">
                  Open Help Center
                </Link>
              </div>
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
            <h1 className="text-2xl font-bold text-gray-900">{booking?.service?.name || booking?.title || 'Service record'}</h1>
            <p className="text-sm text-gray-600">
              {archivedRecord
                ? 'Archived Service Record'
                : followUpRecord
                  ? 'Service Follow-Up'
                  : awaitingApprovedReviewVideo
                    ? 'Awaiting Service Video'
                    : completedWithoutCustomerVisibleVideo
                      ? 'Completed Service Record'
                      : 'Service Videos'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialEntryPoint guide={tutorialGuides.bookingDetail} surface="light" />
            {activeVideo && activeVideo.downloadUrl ? (
              <a
                href="#completed-service-video"
                className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
              >
                {bypassConsent || hasConsent
                  ? 'Watch Video'
                  : hasExistingCustomerReview
                    ? 'Access completed video'
                    : 'Review video access'}
              </a>
            ) : null}
            {canStartInlineReview ? (
              <a
                href="#leave-review"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Leave Review
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void loadPage()}
              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <Link href={resolvedReturnTo} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              {returnLinkLabel}
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">{vendorName}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${bookingStatusBadgeClass(booking?.status)}`}>
                  {bookingStatusDisplay}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  {formatServiceDate(booking?.booking_date)}
                </span>
                {booking?.booking_time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-500" />
                    {bookingTimeDisplay}
                  </span>
                ) : null}
              </div>
            </div>
            {videoReadyFromLink ? <Badge className="bg-emerald-100 text-emerald-800">Video ready</Badge> : null}
          </div>
        </div>

        {privateProofStatus === 'AVAILABLE' && playableVideos.length > 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-950">Private Service Video</p>
                <p className="text-sm leading-6 text-emerald-900">
                  Only you and the approved business team can access these manager-approved stages. Nothing here is Public.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {lifecycleGuidance ? (
          <GuidanceCallout
            title={lifecycleGuidance.title}
            description={lifecycleGuidance.description}
            bullets={lifecycleGuidance.bullets}
            tone={lifecycleGuidance.tone}
          />
        ) : null}

        {lifecycleRows.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">Current service-record state</p>
              <p className="text-xs text-gray-600">
                Work completion, video approval, customer access, and review availability are tracked separately.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {lifecycleRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{row.label}</p>
                  <p className="mt-1 font-medium text-gray-900">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {awaitingApprovedReviewVideo ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
            <p className="text-sm font-medium text-amber-900">Awaiting approved service video</p>
            <p className="text-sm text-amber-900">
              {completedVideoPendingApproval
                ? 'This service record is completed and the final-result video is pending approval before Reliance can open the video-based review flow.'
                : lifecycleVideoState === 'rejected' || lifecycleVideoState === 'approved_not_customer_visible'
                  ? 'This service record is completed, but the submitted final-result video is not customer-visible right now.'
                  : 'This completed service record is still in your review queue, but Reliance cannot open the video-based review flow until an approved final-result video is attached.'}
            </p>
            <p className="text-xs text-amber-800">
              {completedVideoPendingApproval
                ? 'Once approval is complete, this service record will move from Awaiting Service Videos into Ready to Review.'
                : lifecycleVideoState === 'rejected' || lifecycleVideoState === 'approved_not_customer_visible'
                  ? 'If you expected a playable final-result video here, contact support with the reference ID from My Service Records.'
                  : 'Once that approved video is available, this service record will move from Awaiting Service Videos into Ready to Review.'}
            </p>
          </div>
        ) : null}

        {activeVideo && activeVideo.downloadUrl ? (
          <div
            id="completed-service-video"
            className={`rounded-lg border bg-white p-4 space-y-2 ${
              videoReadyFromLink ? 'ring-2 ring-emerald-200 border-emerald-300' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-gray-600">{stageLabel(activeVideo.proofStage)}</p>
              <ReportContentDialog
                targetType="media_asset"
                targetId={activeVideo.id}
                isSignedIn={Boolean(userId)}
                userId={userId}
                triggerLabel="Report video"
                title="Report this video"
                description="Tell us if this video seems unsafe, private, misleading, or otherwise concerning."
                signInHref={`/auth/login?next=${encodeURIComponent(`/my-bookings/${bookingId}`)}`}
                className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              />
            </div>
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
                autoPlayToken={storyAutoPlayToken ?? undefined}
                onEnded={handleStoryStageEnded}
                className="w-full max-w-full"
              />
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-3">
                <p>{activeStageSummary.consentPrompt}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void requestConsent()}
                    disabled={consentStatus === 'checking' || consentStatus === 'requesting'}
                    className="rounded bg-blue-600 px-3 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {consentStatus === 'requesting' ? 'Preparing consent...' : 'Request video access'}
                  </button>
                  <Link
                    href={customerHelpHref}
                    className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Open Help Center
                  </Link>
                </div>
                {consentStatus === 'checking' ? <p className="text-xs text-amber-800">Checking consent status...</p> : null}
                {consentError ? <p className="text-xs text-red-700">{consentError}</p> : null}
              </div>
            )}
            <div className="space-y-0.5 pt-1">
              <p className="text-sm font-semibold text-gray-900">{activeStageSummary.heading}</p>
              <p className="text-sm text-gray-600">{activeStageSummary.description}</p>
            </div>
            {canPlayFullStory ? (
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                <div className="flex flex-wrap items-center gap-2">
                  {bypassConsent || hasConsent ? (
                    <button
                      type="button"
                      onClick={storyMode ? stopFullStoryPlayback : startFullStoryPlayback}
                      className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {storyMode ? 'Stop service story' : 'Play full service story'}
                    </button>
                  ) : null}
                  <p className="text-sm">
                    {bypassConsent || hasConsent
                      ? 'Watch the Starting Condition, Work in Progress, and Final Result stages in sequence, or use the stage buttons below to jump to one part.'
                      : 'Approve video access first, then you can watch the full service story straight through or jump to one stage below.'}
                  </p>
                </div>
                {storyMode ? (
                  <p className="mt-2 text-xs text-blue-800">
                    {nextStoryStageLabel
                      ? `Up next: ${nextStoryStageLabel}`
                      : 'This is the final stage of the service story.'}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : approvedVideos.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            Video submitted, awaiting approval.
          </div>
        ) : proofPendingApproval ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700 space-y-1">
            <p className="font-medium text-gray-900">Video submitted, awaiting approval</p>
            <p>The vendor has submitted a service video and it is being reviewed before it can be shown here.</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700 space-y-1">
            <p className="font-medium text-gray-900">
              {archivedRecord
                ? 'No retained media'
                : followUpRecord
                  ? 'No approved service video is attached yet'
                  : completedVideoPendingApproval
                    ? 'Service completed. Video is pending approval.'
                  : awaitingApprovedReviewVideo
                    ? 'No approved video is attached yet'
                    : completedWithoutCustomerVisibleVideo
                      ? 'No customer-visible service video available'
                      : 'Video not available yet'}
            </p>
            <p>
              {archivedRecord
                ? 'This archived record does not currently include retained customer-visible media.'
                : followUpRecord
                  ? 'This service date passed without a completed vendor closeout, so no approved service video is attached yet.'
                  : completedVideoPendingApproval
                    ? 'The vendor submitted a final-result video and it is still being reviewed before it can be shown here.'
                  : awaitingApprovedReviewVideo
                    ? lifecycleVideoState === 'rejected' || lifecycleVideoState === 'approved_not_customer_visible'
                      ? 'A final-result video was submitted for this service record, but it is not customer-visible right now.'
                      : 'We will open the final-result video and review flow here after an approved final-result video is attached.'
                    : completedWithoutCustomerVisibleVideo
                      ? reviewSubmitted
                        ? 'This completed service record already has a submitted review on file, but no customer-visible approved service video is currently attached.'
                        : lifecycleVideoState === 'rejected'
                          ? 'This service record is marked completed, and a final-result video was submitted, but it is not customer-visible right now.'
                          : lifecycleVideoState === 'approved_not_customer_visible'
                            ? 'This service record is marked completed, and a final-result video exists, but it is not customer-visible right now.'
                            : 'This service record is marked completed, but no customer-visible approved service video is currently attached.'
                      : 'No customer-visible approved service video is available for this job yet.'}
            </p>
            {archivedRecord ? (
              <p className="text-xs text-gray-500">This record is kept for reference only.</p>
            ) : followUpRecord ? (
              <p className="text-xs text-gray-500">If you still need help on this service record, contact support with the reference ID from My Service Records.</p>
            ) : completedVideoPendingApproval ? (
              <p className="text-xs text-gray-500">You&apos;ll be notified once approval is complete and the video can be opened here.</p>
            ) : awaitingApprovedReviewVideo ? (
              <p className="text-xs text-gray-500">
                {lifecycleVideoState === 'rejected' || lifecycleVideoState === 'approved_not_customer_visible'
                  ? 'If you expected a playable final-result video here, contact support and include the reference ID from My Service Records.'
                  : "You'll be notified when the approved video is ready."}
              </p>
            ) : completedWithoutCustomerVisibleVideo ? (
              <p className="text-xs text-gray-500">
                {reviewSubmitted
                  ? 'Your earlier review remains on file even though this completed service record does not currently include a customer-visible service video.'
                  : 'If you expected a playable service video here, contact support and include the reference ID from My Service Records.'}
              </p>
            ) : (
              <p className="text-xs text-gray-500">You&apos;ll be notified when video is ready.</p>
            )}
            {(archivedRecord || followUpRecord || completedWithoutCustomerVisibleVideo) ? (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={customerHelpHref}
                  className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                >
                  Open Help Center
                </Link>
              </div>
            ) : awaitingApprovedReviewVideo ? (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={customerHelpHref}
                  className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                >
                  Open Help Center
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {playableVideos.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900">Service Video Timeline</p>
            {!hasStageInteraction ? (
              <p className="text-xs text-gray-500">
                {canPlayFullStory
                  ? 'Play the full service story above, or tap any stage below to jump directly to it.'
                  : 'Tap to view each shared stage of the service.'}
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'before' as const,
                  title: 'Starting Condition',
                  subtitle: 'How the work looked before service began',
                },
                {
                  key: 'during' as const,
                  title: 'Work in Progress',
                  subtitle: 'What changed while the work was underway',
                },
                {
                  key: 'after' as const,
                  title: 'Final Result',
                  subtitle: 'How the completed work looked afterward',
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
                      setStoryMode(false);
                      setStoryAutoPlayToken(null);
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
                        {isActive
                          ? storyMode
                            ? 'Playing now'
                            : 'Selected'
                          : bypassConsent || hasConsent
                            ? 'Watch video'
                            : 'Open stage'}
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

        {hasExistingCustomerReview ? (
          <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-gray-900">Your review is already submitted</p>
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={`existing-review-${index}`}
                    className={`h-4 w-4 ${
                      index < Math.max(0, Math.min(5, Math.round(existingCustomerReview?.rating || 0)))
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-600">
                Submitted on {formatServiceDate(existingCustomerReview?.submittedAt)}
              </p>
              <p className="text-sm text-gray-700">
                {existingCustomerReview?.comment?.trim() || 'No written comment was included with this review.'}
              </p>
            </div>
            <p className="text-sm text-gray-600">{existingReviewSupportMessage}</p>
          </div>
        ) : null}

        {!hasExistingCustomerReview ? (
          archivedRecord ? (
            <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">Archived record</p>
              <p className="text-sm text-gray-700">
                This archived service record is kept for reference only. New review prompts are no longer active here.
              </p>
            </div>
          ) : followUpRecord && !hasReviewableCompletedVideo ? (
            <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">Review not active yet</p>
              <p className="text-sm text-gray-700">
                This service date passed without an approved completed-work video, so review prompts are not active on this service record yet.
              </p>
            </div>
          ) : !canShowInlineReview ? (
            <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">
                {awaitingApprovedReviewVideo ? 'Review not active yet' : 'Review availability'}
              </p>
              <p className="text-sm text-gray-700">
                {awaitingApprovedReviewVideo
                  ? 'Your review stays paused until the approved final-result video is attached.'
                  : reviewGateMessage || 'Review prompts are not active for this stage yet.'}
              </p>
            </div>
          ) : !consentAllowsInlineReview ? (
            <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">Approve video access first</p>
              <p className="text-sm text-gray-700">
                {reviewGateMessage || 'Approve video access before leaving your review.'}
              </p>
            </div>
          ) : (
            <div id="leave-review" className="rounded-lg border bg-white p-4 space-y-3">
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
                  disabled={!canStartInlineReview || !reviewWindowId || reviewSubmitting}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Leave Review'}
                </button>
                {reviewGateMessage ? <span className="text-xs text-gray-500">{reviewGateMessage}</span> : null}
                {canStartInlineReview && !reviewWindowId ? (
                  <span className="text-xs text-gray-500">Preparing review session...</span>
                ) : null}
              </div>
              {reviewStatusMessage ? <p className="text-xs text-emerald-700">{reviewStatusMessage}</p> : null}
              {reviewError ? <p className="text-xs text-red-700">{reviewError}</p> : null}
            </div>
          )
        ) : null}

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
                <span className="font-medium text-gray-900">Reference ID:</span>{' '}
                <span className="font-mono text-xs">{bookingId}</span>
              </p>
              <p>
                <span className="font-medium text-gray-900">Service:</span> {booking?.service?.name || booking?.title || 'Service record'}
              </p>
              <p>
                <span className="font-medium text-gray-900">Vendor:</span> {vendorName}
              </p>
              <p>
                <span className="font-medium text-gray-900">Date:</span> {formatServiceDate(booking?.booking_date)}
                {booking?.booking_time ? ` at ${bookingTimeDisplay}` : ''}
              </p>
              <p>
                <span className="font-medium text-gray-900">Notes:</span> {booking?.notes?.trim() ? booking.notes : 'No additional details provided.'}
              </p>
              {nonStageAdditionalMedia.length > 0 ? (
                <p className="text-xs text-gray-500">
                  Additional approved files are available for this service record ({nonStageAdditionalMedia.length}).
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BookingMediaDetailPageFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
        Loading service record details...
      </div>
    </div>
  );
}

export default function BookingMediaDetailPage() {
  return (
    <Suspense fallback={<BookingMediaDetailPageFallback />}>
      <BookingMediaDetailPageContent />
    </Suspense>
  );
}
