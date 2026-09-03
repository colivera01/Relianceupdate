'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  LogIn,
  Play,
  RotateCcw,
  ShieldCheck,
  Star,
  UserPlus,
} from 'lucide-react';
import { SmartVideoPlayer } from '@/components/reviews/SmartVideoPlayer';
import { ReportContentDialog } from '@/components/reports/ReportContentDialog';
import { PackageVisibilityCard } from '@/components/service-video/PackageVisibilityCard';
import { VendorFavoriteButton } from '@/components/favorites/VendorFavoriteButton';
import { useAuth } from '@/contexts/AuthContext';
import { appendAuthNext } from '@/lib/auth-next';
import { getClientSessionHeaders } from '@/lib/client-session';
import {
  getForwardPlaybackStages,
  getNextPlaybackStage,
  type CustomerServiceVideoStage,
} from '@/lib/customer-service-video-playback';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import type { CustomerServiceRecordState } from '@/lib/customer-service-record-state';
import { getCustomerProofStageLabel } from '@/lib/vendor-job-video-stages';

type AssignedServiceProfessional = {
  membershipId: string;
  userId: string;
  name: string;
};

type CustomerReview = {
  id: string;
  rating: number;
  comment: string;
  submittedAt: string;
  employeeRating?: {
    rating: number;
    employeeMembershipId: string;
    employeeUserId: string;
    employeeName: string;
    submittedAt: string;
  } | null;
};

type BookingDetail = {
  id: string;
  title: string | null;
  status: string | null;
  booking_date: string | null;
  booking_time: string | null;
  notes?: string | null;
  service?: { id?: string | null; name?: string | null } | null;
  vendor?: {
    id?: string | null;
    name?: string | null;
    business_name?: string | null;
    businessName?: string | null;
  } | null;
  customerReview?: CustomerReview | null;
  customerRecord?: CustomerServiceRecordState | null;
};

type BookingMediaAsset = {
  id: string;
  title: string;
  type?: string;
  moderationStatus?: string;
  visibilityStatus?: string;
  downloadUrl?: string | null;
  mimeType: string;
  mediaSessionId: string | null;
  proofStage?: CustomerServiceVideoStage | null;
};

type BookingClaimIssue = { code: string; message: string };

const STAGE_COPY: Record<CustomerServiceVideoStage, { title: string; description: string }> = {
  before: {
    title: 'Starting Condition',
    description: 'The work area before service began.',
  },
  during: {
    title: 'Work in Progress',
    description: 'The service while work was underway.',
  },
  after: {
    title: 'Final Result',
    description: 'The completed result after service.',
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function RatingButtons({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          onClick={() => onChange(rating)}
          className="rounded-md p-1.5 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Star
            className={`h-7 w-7 ${rating <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

function BookingMediaDetailPageContent() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = String(params?.bookingId || '').trim();
  const { user, isLoading: authLoading, logout } = useAuth();
  const userId = resolveCustomerUserId(user?.id);
  const videoReadyFromLink = searchParams?.get('videoReady') === '1' || searchParams?.get('proofReady') === '1';
  const claimToken = String(searchParams?.get('claimToken') || '').trim();
  const returnToReviews = searchParams?.get('returnTo') === '/reviews';
  const returnHref = returnToReviews ? '/reviews' : '/my-bookings';
  const returnLabel = returnToReviews ? 'Back to My Reviews' : 'Back to My Service Records';
  const currentPath = `/my-bookings/${bookingId}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
  const registrationHref = appendAuthNext('/auth/register?type=user', currentPath);
  const loginHref = appendAuthNext('/auth/login', currentPath);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimIssue, setClaimIssue] = useState<BookingClaimIssue | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [assets, setAssets] = useState<BookingMediaAsset[]>([]);
  const [privateProofAvailable, setPrivateProofAvailable] = useState(false);
  const [assignedProfessional, setAssignedProfessional] = useState<AssignedServiceProfessional | null>(null);
  const [activeStage, setActiveStage] = useState<CustomerServiceVideoStage | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<CustomerServiceVideoStage[]>([]);
  const [autoPlayToken, setAutoPlayToken] = useState<number | null>(null);
  const [pendingNextStage, setPendingNextStage] = useState<CustomerServiceVideoStage | null>(null);
  const [transitionSeconds, setTransitionSeconds] = useState(3);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [completePlaybackFinished, setCompletePlaybackFinished] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewWindowId, setReviewWindowId] = useState<string | null>(null);
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [vendorRating, setVendorRating] = useState(0);
  const [employeeRating, setEmployeeRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [organizationMessage, setOrganizationMessage] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!bookingId || !userId) {
      setLoading(false);
      if (!userId) setError('Sign in to view this service record.');
      return;
    }
    setLoading(true);
    setError(null);
    setClaimIssue(null);
    try {
      if (videoReadyFromLink) {
        const claimResponse = await fetch(`/api/bookings/${bookingId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getClientSessionHeaders(userId) },
          credentials: 'include',
          body: JSON.stringify({ claimToken }),
        });
        const claimJson = await claimResponse.json().catch(() => ({}));
        if (!claimResponse.ok) {
          const code = String(claimJson?.code || '').trim();
          if (code === 'CLAIM_EMAIL_MISMATCH' || code === 'BOOKING_ALREADY_CLAIMED') {
            setClaimIssue({ code, message: String(claimJson?.error || 'This service record belongs to another account.') });
            return;
          }
          throw new Error(String(claimJson?.error || 'Unable to connect this service record.'));
        }
        if (claimToken) {
          const nextParams = new URLSearchParams(searchParams?.toString() || '');
          nextParams.delete('claimToken');
          router.replace(`/my-bookings/${bookingId}${nextParams.toString() ? `?${nextParams}` : ''}`);
        }
      }

      const [bookingResponse, mediaResponse] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`, { cache: 'no-store', credentials: 'include' }),
        fetch(`/api/bookings/${bookingId}/media`, { cache: 'no-store', credentials: 'include' }),
      ]);
      const bookingJson = await bookingResponse.json().catch(() => ({}));
      const mediaJson = await mediaResponse.json().catch(() => ({}));
      if (!bookingResponse.ok) throw new Error(String(bookingJson?.error || 'Unable to load this service record.'));
      const resolvedCustomerRecord = bookingJson?.customerRecord as CustomerServiceRecordState | null;
      if (!mediaResponse.ok && resolvedCustomerRecord?.video?.state === 'READY') {
        throw new Error(String(mediaJson?.error || 'Unable to load the Service Video.'));
      }

      const nextBooking = (bookingJson?.booking || null) as BookingDetail | null;
      if (nextBooking) {
        nextBooking.customerReview = bookingJson?.customerReview || null;
        nextBooking.customerRecord = bookingJson?.customerRecord || null;
      }
      const nextAssets = mediaResponse.ok && Array.isArray(mediaJson?.assets) ? mediaJson.assets as BookingMediaAsset[] : [];
      setBooking(nextBooking);
      setAssets(nextAssets);
      setPrivateProofAvailable(mediaResponse.ok && mediaJson?.privateProofStatus === 'AVAILABLE');
      setAssignedProfessional(bookingJson?.assignedServiceProfessional || null);
      const firstStage = (['before', 'during', 'after'] as const).find((stage) =>
        nextAssets.some((asset) => asset.proofStage === stage && asset.downloadUrl)
      );
      setActiveStage(firstStage || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this service record.');
      setBooking(null);
      setAssets([]);
      setPrivateProofAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [bookingId, claimToken, router, searchParams, userId, videoReadyFromLink]);

  useEffect(() => {
    if (!authLoading) void loadPage();
  }, [authLoading, loadPage]);

  const videosByStage = useMemo(() => {
    const result: Partial<Record<CustomerServiceVideoStage, BookingMediaAsset>> = {};
    for (const asset of assets) {
      if (
        asset.proofStage &&
        asset.downloadUrl &&
        String(asset.type || '').toLowerCase() === 'video' &&
        String(asset.moderationStatus || '').toLowerCase() === 'approved' &&
        !result[asset.proofStage]
      ) {
        result[asset.proofStage] = asset;
      }
    }
    return result;
  }, [assets]);

  const availableStages = useMemo(
    () => (['before', 'during', 'after'] as const).filter((stage) => Boolean(videosByStage[stage])),
    [videosByStage]
  );
  const activeVideo = activeStage ? videosByStage[activeStage] || null : null;
  const finalVideo = videosByStage.after || null;
  const serviceName = booking?.service?.name || booking?.title || 'Service record';
  const vendorName = booking?.vendor?.business_name || booking?.vendor?.businessName || booking?.vendor?.name || 'Service provider';
  const existingReview = booking?.customerReview || null;
  const customerRecord = booking?.customerRecord || null;
  const completedRecord = customerRecord?.lifecycle === 'COMPLETED';
  const videoReady = completedRecord && customerRecord?.video.state === 'READY';
  const canReview = Boolean(customerRecord?.review.state === 'LEAVE_REVIEW' && booking?.vendor?.id && !existingReview);
  const supportHref = `/customer/support?returnTo=${encodeURIComponent(`/my-bookings/${bookingId}`)}&returnLabel=${encodeURIComponent('Back to service record')}`;

  const changeOrganization = async (action: 'ARCHIVE' | 'RESTORE') => {
    if (!booking || organizationBusy) return;
    const confirmed = window.confirm(action === 'ARCHIVE'
      ? 'Archive this Service Record?\n\nIt will move to Archived. Your Service Record and authorized video remain available.'
      : 'Restore this Service Record to My Service Records?');
    if (!confirmed) return;
    setOrganizationBusy(true);
    setOrganizationMessage(null);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId: globalThis.crypto.randomUUID() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Unable to update this Service Record.'));
      setOrganizationMessage(String(body?.message || 'Service Record updated.'));
      await loadPage();
    } catch (caught) {
      setOrganizationMessage(caught instanceof Error ? caught.message : 'Unable to update this Service Record.');
    } finally {
      setOrganizationBusy(false);
    }
  };

  const startPlayback = (stage: CustomerServiceVideoStage) => {
    const queue = getForwardPlaybackStages(stage, availableStages);
    if (queue.length === 0) return;
    setPendingNextStage(null);
    setTransitionSeconds(3);
    setAutoplayBlocked(false);
    setCompletePlaybackFinished(false);
    setPlaybackQueue(queue);
    setActiveStage(queue[0]);
    setAutoPlayToken(Date.now());
  };

  const stopPlayback = () => {
    setPlaybackQueue([]);
    setPendingNextStage(null);
    setAutoPlayToken(null);
    setAutoplayBlocked(false);
  };

  const playPendingStage = useCallback(() => {
    if (!pendingNextStage) return;
    setActiveStage(pendingNextStage);
    setPendingNextStage(null);
    setTransitionSeconds(3);
    setAutoplayBlocked(false);
    setAutoPlayToken(Date.now());
  }, [pendingNextStage]);

  useEffect(() => {
    if (!pendingNextStage) return;
    if (transitionSeconds <= 0) {
      playPendingStage();
      return;
    }
    const timer = window.setTimeout(() => setTransitionSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [pendingNextStage, playPendingStage, transitionSeconds]);

  const handleStageEnded = () => {
    if (!activeStage) return;
    const nextStage = getNextPlaybackStage(activeStage, playbackQueue);
    if (nextStage) {
      setPendingNextStage(nextStage);
      setTransitionSeconds(3);
      return;
    }
    setPlaybackQueue([]);
    setAutoPlayToken(null);
    if (activeStage === 'after') setCompletePlaybackFinished(true);
  };

  const beginReview = async () => {
    if (!canReview || !booking?.vendor?.id || reviewBusy) return;
    setReviewOpen(true);
    setReviewBusy(true);
    setReviewError(null);
    try {
      const response = await fetch('/api/reviews/window/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          vendorId: String(booking.vendor.id),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.reviewWindow?.id) {
        throw new Error(String(body?.error || 'Unable to start your review.'));
      }
      setReviewWindowId(String(body.reviewWindow.id));
      setReviewRequestId((current) => current || globalThis.crypto.randomUUID());
    } catch (caught) {
      setReviewWindowId(null);
      setReviewError(caught instanceof Error ? caught.message : 'Unable to start your review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const submitReview = async () => {
    if (!reviewWindowId || !booking?.vendor?.id || vendorRating < 1 || reviewBusy) {
      if (vendorRating < 1) setReviewError('Choose a rating for the business before submitting.');
      return;
    }
    setReviewBusy(true);
    setReviewError(null);
    try {
      const response = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewWindowId,
          requestId: reviewRequestId || globalThis.crypto.randomUUID(),
          bookingId,
          vendorId: String(booking.vendor.id),
          rating: vendorRating,
          employeeRating: employeeRating || undefined,
          comment: reviewComment.trim(),
          submittedVia: 'service_record',
          reviewAttributionTarget: 'overall_business',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Unable to submit your review.'));
      setReviewSuccess('Thank you for your review.');
      setBooking((current) => current ? {
        ...current,
        customerReview: {
          id: String(body?.review?.id || ''),
          rating: vendorRating,
          comment: reviewComment.trim(),
          submittedAt: new Date().toISOString(),
          employeeRating: employeeRating && assignedProfessional ? {
            rating: employeeRating,
            employeeMembershipId: assignedProfessional.membershipId,
            employeeUserId: assignedProfessional.userId,
            employeeName: assignedProfessional.name,
            submittedAt: new Date().toISOString(),
          } : null,
        },
      } : current);
      setReviewOpen(false);
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : 'Unable to submit your review.');
    } finally {
      setReviewBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-slate-600">Loading your service record...</div>;
  }

  if (claimIssue) {
    return (
      <div className="mx-auto flex min-h-[64vh] max-w-2xl items-center px-4 py-10">
        <div className="w-full rounded-lg border border-slate-700 bg-slate-950 p-7 text-white shadow-xl">
          <ShieldCheck className="h-9 w-9 text-blue-300" />
          <p className="mt-5 text-xs font-semibold uppercase text-blue-200">Customer account protection</p>
          <h1 className="mt-2 text-2xl font-semibold">This video was shared with another customer email</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{claimIssue.message}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void logout(registrationHref)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold">
              <UserPlus className="h-4 w-4" /> Switch Account and Register
            </button>
            <button type="button" onClick={() => void logout(loginHref)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold">
              <LogIn className="h-4 w-4" /> Switch Account and Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
        <div className="mt-4 flex gap-3 text-sm">
          <button type="button" onClick={() => void loadPage()} className="font-medium text-blue-700 underline">Try again</button>
          <Link href={returnHref} className="font-medium text-blue-700 underline">{returnLabel}</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={returnHref} className="text-sm font-medium text-blue-700 hover:underline">{returnLabel}</Link>
          <Link href={supportHref} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-700">
            <CircleHelp className="h-4 w-4" /> Support & Help
          </Link>
        </div>

        {organizationMessage ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
            {organizationMessage}
          </p>
        ) : null}

        <section aria-labelledby="service-heading" className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase text-emerald-700">
            {videoReady
              ? 'Reliance Service Video Approved'
              : customerRecord?.lifecycle === 'COMPLETED'
                ? 'Completed Service Record'
                : customerRecord?.lifecycle === 'CANCELLED'
                  ? 'Cancelled Service Record'
                  : customerRecord?.lifecycle === 'UPCOMING'
                    ? 'Upcoming Service'
                    : 'Service Record'}
          </p>
          <h1 id="service-heading" className="mt-2 text-3xl font-semibold text-slate-950">{serviceName}</h1>
          <p className="mt-2 text-lg text-slate-700">{vendorName}</p>
          {completedRecord && booking?.vendor?.id ? (
            <div className="mt-4">
              <VendorFavoriteButton vendorId={String(booking.vendor.id)} vendorName={vendorName} />
            </div>
          ) : null}
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" /> {completedRecord ? 'Completed' : customerRecord?.lifecycle === 'CANCELLED' ? 'Service date' : 'Scheduled'} {formatDate(booking?.booking_date)}
          </p>
          {customerRecord?.cancellation ? (
            <dl className="mt-4 space-y-1 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div><dt className="inline font-medium text-slate-950">Cancelled by: </dt><dd className="inline">{customerRecord.cancellation.actorLabel || 'Unavailable for this historical record'}</dd></div>
              <div><dt className="inline font-medium text-slate-950">Reason: </dt><dd className="inline">{customerRecord.cancellation.reason || 'Reason unavailable for this historical record'}</dd></div>
              {customerRecord.cancellation.cancelledAt ? <div><dt className="inline font-medium text-slate-950">Date: </dt><dd className="inline">{formatDate(customerRecord.cancellation.cancelledAt)}</dd></div> : null}
            </dl>
          ) : null}
        </section>

        {completedRecord ? <section aria-labelledby="video-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="video-heading" className="text-2xl font-semibold text-slate-950">Your Service Video</h2>
              <p className="mt-1 text-sm text-slate-600">Watch each approved stage or play the complete service in order.</p>
            </div>
            {videosByStage.before ? (
              <button type="button" onClick={() => startPlayback('before')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <Play className="h-4 w-4 fill-current" /> Play complete Service Video
              </button>
            ) : null}
          </div>

          {privateProofAvailable && availableStages.length > 0 ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {(['before', 'during', 'after'] as const).map((stage) => {
                  const video = videosByStage[stage];
                  return (
                    <div key={stage} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-950">{STAGE_COPY[stage].title}</p>
                      <p className="mt-1 min-h-10 text-sm text-slate-600">{STAGE_COPY[stage].description}</p>
                      <button
                        type="button"
                        disabled={!video}
                        onClick={() => startPlayback(stage)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        <Play className="h-4 w-4 fill-current" /> {video ? 'Watch' : 'Unavailable'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {activeVideo?.downloadUrl && activeStage ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-live="polite">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-700">Now showing</p>
                      <h3 className="text-lg font-semibold text-slate-950">{STAGE_COPY[activeStage].title}</h3>
                    </div>
                    <ReportContentDialog
                      targetType="media_asset"
                      targetId={activeVideo.id}
                      isSignedIn={Boolean(userId)}
                      userId={userId}
                      triggerLabel="Report a problem with this video"
                      title="Report this video"
                      description="Tell us if this video seems unsafe, private, misleading, or otherwise concerning."
                      signInHref={`/auth/login?next=${encodeURIComponent(`/my-bookings/${bookingId}`)}`}
                      technicalHelpHref={supportHref}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    />
                  </div>
                  <SmartVideoPlayer
                    src={activeVideo.downloadUrl}
                    bookingId={bookingId}
                    vendorId={String(booking?.vendor?.id || '')}
                    mediaSessionId={activeVideo.mediaSessionId || activeVideo.id}
                    reviewCaptureEnabled={false}
                    autoPlayToken={autoPlayToken ?? undefined}
                    onAutoPlayBlocked={() => setAutoplayBlocked(true)}
                    onEnded={handleStageEnded}
                  />
                  {autoplayBlocked ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Your browser paused automatic playback. Press play in the video to continue with {STAGE_COPY[activeStage].title}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {pendingNextStage ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3" role="status">
                  <div>
                    <p className="font-semibold text-blue-950">Up next: {STAGE_COPY[pendingNextStage].title}</p>
                    <p className="text-sm text-blue-800">Starting automatically in {transitionSeconds} second{transitionSeconds === 1 ? '' : 's'}...</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={playPendingStage} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Play now</button>
                    <button type="button" onClick={stopPlayback} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">Stop</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
              The approved Service Video is not available for this account.
            </div>
          )}
        </section> : null}

        {completedRecord && completePlaybackFinished && !existingReview ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="font-semibold text-emerald-950">That&apos;s the complete Service Video.</p>
            <p className="mt-1 text-sm text-emerald-900">How was your experience with {vendorName}?</p>
            <button type="button" onClick={() => void beginReview()} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Leave a review</button>
          </section>
        ) : null}

        {completedRecord ? <section id="your-review" aria-labelledby="review-heading" className="border-t border-slate-200 pt-6">
          <h2 id="review-heading" className="text-2xl font-semibold text-slate-950">Your Review</h2>
          {existingReview ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-5">
              <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Reviewed</span></div>
              <div className="mt-3 flex gap-1" aria-label={`${existingReview.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((rating) => <Star key={rating} className={`h-5 w-5 ${rating <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
              </div>
              {existingReview.comment ? <p className="mt-3 text-sm text-slate-700">{existingReview.comment}</p> : null}
              {existingReview.employeeRating ? <p className="mt-3 text-sm text-slate-600">You also rated {existingReview.employeeRating.employeeName} {existingReview.employeeRating.rating} out of 5.</p> : null}
            </div>
          ) : canReview ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              {!reviewOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">How was your experience with {vendorName}?</p>
                    <p className="mt-1 text-sm text-slate-600">You can review this completed service whether or not you watch every stage.</p>
                  </div>
                  <button type="button" onClick={() => void beginReview()} disabled={reviewBusy} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    {reviewBusy ? 'Opening...' : 'Leave a review'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="font-semibold text-slate-950">How was your experience with {vendorName}?</p>
                    <RatingButtons value={vendorRating} onChange={setVendorRating} label={`Rate ${vendorName}`} />
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-800">Share more about your experience (optional)</span>
                    <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </label>
                  {assignedProfessional ? (
                    <div className="border-t border-slate-200 pt-4">
                      <p className="font-semibold text-slate-950">How was your experience with {assignedProfessional.name}?</p>
                      <p className="mt-1 text-sm text-slate-600">Optional. This is separate from your rating of {vendorName}.</p>
                      <RatingButtons value={employeeRating} onChange={setEmployeeRating} label={`Rate ${assignedProfessional.name}`} />
                      {employeeRating ? <button type="button" onClick={() => setEmployeeRating(0)} className="mt-1 text-xs font-medium text-slate-600 underline">Clear employee rating</button> : null}
                    </div>
                  ) : null}
                  {reviewError ? <p className="text-sm text-red-700">{reviewError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void submitReview()} disabled={reviewBusy || !reviewWindowId} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{reviewBusy ? 'Submitting...' : 'Submit review'}</button>
                    <button type="button" onClick={() => { setReviewOpen(false); setReviewError(null); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              )}
              {reviewError && !reviewOpen ? <p className="mt-3 text-sm text-red-700">{reviewError}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">A review becomes available with an approved Private Service Video.</p>
          )}
          {reviewSuccess ? <p className="mt-3 text-sm font-medium text-emerald-700">{reviewSuccess}</p> : null}
          {reviewSuccess && booking?.vendor?.id ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950">Want to use {vendorName} again?</p>
              <VendorFavoriteButton vendorId={String(booking.vendor.id)} vendorName={vendorName} className="mt-3" />
            </div>
          ) : null}
        </section> : null}

        {videoReady ? <section aria-labelledby="visibility-heading" className="border-t border-slate-200 pt-6">
          <h2 id="visibility-heading" className="mb-3 text-2xl font-semibold text-slate-950">Visibility</h2>
          <PackageVisibilityCard role="customer" bookingId={bookingId} />
        </section> : null}

        <section className="border-t border-slate-200 pt-4">
          <button type="button" onClick={() => setShowDetails((visible) => !visible)} aria-expanded={showDetails} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-blue-700">
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? 'Hide service details' : 'View service details'}
          </button>
          {showDetails ? (
            <dl className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
              <div><dt className="font-medium text-slate-500">Reference</dt><dd className="mt-1 font-mono text-xs text-slate-900">{bookingId}</dd></div>
              <div><dt className="font-medium text-slate-500">Status</dt><dd className="mt-1 text-slate-900">{customerRecord?.lifecycleLabel || 'Status unavailable'}</dd></div>
              <div><dt className="font-medium text-slate-500">Service</dt><dd className="mt-1 text-slate-900">{serviceName}</dd></div>
              <div><dt className="font-medium text-slate-500">Vendor</dt><dd className="mt-1 text-slate-900">{vendorName}</dd></div>
              <div><dt className="font-medium text-slate-500">{completedRecord ? 'Completed' : 'Service date'}</dt><dd className="mt-1 text-slate-900">{formatDate(booking?.booking_date)}</dd></div>
              {videoReady ? <div><dt className="font-medium text-slate-500">Service Video</dt><dd className="mt-1 text-slate-900">Reliance approved</dd></div> : null}
              <div><dt className="font-medium text-slate-500">Assigned professional</dt><dd className="mt-1 text-slate-900">{assignedProfessional?.name || 'Not listed'}</dd></div>
              {booking?.notes?.trim() ? <div className="sm:col-span-2"><dt className="font-medium text-slate-500">Notes</dt><dd className="mt-1 text-slate-900">{booking.notes}</dd></div> : null}
            </dl>
          ) : null}
          {booking?.customerRecord && (booking.customerRecord.archiveEligible || booking.customerRecord.restoreEligible || booking.customerRecord.legacyRestoreBlocked) ? (
          <div className="mt-5 border-t border-slate-200 pt-4">
            {booking?.customerRecord?.archiveEligible ? (
              <button
                type="button"
                disabled={organizationBusy}
                onClick={() => void changeOrganization('ARCHIVE')}
                className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" /> Archive Service Record
              </button>
            ) : null}
            {booking?.customerRecord?.restoreEligible ? (
              <button
                type="button"
                disabled={organizationBusy}
                onClick={() => void changeOrganization('RESTORE')}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> Restore to Service Records
              </button>
            ) : null}
            {booking?.customerRecord?.legacyRestoreBlocked ? (
              <p className="text-sm text-slate-600">
                This historical archive remains available, but its prior lifecycle cannot be safely restored.{' '}
                <Link href={supportHref} className="font-medium text-blue-700 underline">Contact Support</Link>.
              </p>
            ) : null}
          </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function BookingMediaDetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-12 text-sm text-slate-600">Loading your service record...</div>}>
      <BookingMediaDetailPageContent />
    </Suspense>
  );
}
