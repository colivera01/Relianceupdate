'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Info, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate, formatDisplayTime } from '@/lib/date-display';
import {
  bookingMatchesSearch,
  bookingMatchesTab,
  classifyCancelBookingAction,
  formatMyBookingsStatusDisplay,
  isArchivedStatus,
  isCompletedStatus,
  normalizeBookingStatusKey,
  resolveBookingScheduleInstant,
  sanitizeMyBookingsRow,
  safeSortByCreatedAtDesc,
  shouldEnableReviewCaptureForStatus,
  type MyBookingsTab,
  type MyBookingsRow,
} from '@/lib/my-bookings';
import { resolveCustomerUserId } from '@/lib/customer-user-id';

type MediaState = {
  loading: boolean;
  error: string | null;
  total: number | null;
  /** True after a successful GET, even when total is 0. Used for truthful empty vs not-yet-loaded. */
  loaded: boolean;
  /** Count of image assets returned. GET includes approved customer-visible images. */
  imageCount?: number;
  videos?: Array<{
    id: string;
    title: string;
    downloadUrl: string | null;
    mediaSessionId: string | null;
    isPrimaryProofVideo?: boolean;
    createdAt?: string | null;
  }>;
};

type BookingProofVideo = NonNullable<MediaState['videos']>[number];

type ProofSignal = {
  loading: boolean;
  hasSharedProof: boolean;
  lastSharedAt: string | null;
  recentlyUpdated: boolean;
};

function mediaHintForError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('consent')) {
    return 'Complete any consent request from your vendor (email or link) if you have not already.';
  }
  if (m.includes('forbidden') || m.includes('not belong')) {
    return 'If this keeps happening, sign out and back in with the account that owns this service.';
  }
  return null;
}

export default function MyBookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<MyBookingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MyBookingsTab>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [mediaByBooking, setMediaByBooking] = useState<Record<string, MediaState>>({});
  const [proofSignalByBooking, setProofSignalByBooking] = useState<Record<string, ProofSignal>>({});
  const customerHelpHref =
    '/customer/support?returnTo=%2Fmy-bookings&returnLabel=Back%20to%20My%20Service%20Records';

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = resolveCustomerUserId(user?.id);
      if (!userId) {
        setBookings([]);
        setError(null);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/bookings`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load services (${res.status})`);
      }
      const raw = Array.isArray(json?.bookings) ? json.bookings : [];
      const next = raw
        .map(sanitizeMyBookingsRow)
        .filter((row: MyBookingsRow | null): row is MyBookingsRow => row != null);
      setBookings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load services');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void fetchBookings();
  }, [authLoading, user?.id, fetchBookings]);

  const filtered = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b) => {
        const statusKey = normalizeBookingStatusKey(b.status);
        const { instant: scheduleInstant } = resolveBookingScheduleInstant(
          b.booking_date,
          b.booking_time,
          b.created_at
        );
        if (!bookingMatchesTab(activeTab, statusKey, scheduleInstant, now)) return false;
        return bookingMatchesSearch(b, searchTerm);
      })
      .sort(safeSortByCreatedAtDesc);
  }, [bookings, activeTab, searchTerm]);

  const tabCounts = useMemo(() => {
    const now = new Date();
    return bookings.reduce(
      (acc, booking) => {
        const statusKey = normalizeBookingStatusKey(booking.status);
        const { instant: scheduleInstant } = resolveBookingScheduleInstant(
          booking.booking_date,
          booking.booking_time,
          booking.created_at
        );
        if (bookingMatchesTab('upcoming', statusKey, scheduleInstant, now)) acc.upcoming += 1;
        if (bookingMatchesTab('past', statusKey, scheduleInstant, now)) acc.past += 1;
        if (bookingMatchesTab('archived', statusKey, scheduleInstant, now)) acc.archived += 1;
        if (bookingMatchesTab('needs_follow_up', statusKey, scheduleInstant, now)) acc.needs_follow_up += 1;
        if (bookingMatchesTab('cancelled', statusKey, scheduleInstant, now)) acc.cancelled += 1;
        return acc;
      },
      { upcoming: 0, past: 0, archived: 0, needs_follow_up: 0, cancelled: 0 }
    );
  }, [bookings]);

  const proofCandidates = useMemo(() => {
    const now = new Date();
    return [...bookings]
      .filter((booking) => {
        const statusKey = normalizeBookingStatusKey(booking.status);
        const { instant: scheduleInstant } = resolveBookingScheduleInstant(
          booking.booking_date,
          booking.booking_time,
          booking.created_at
        );
        return (
          isArchivedStatus(statusKey) ||
          bookingMatchesTab('needs_follow_up', statusKey, scheduleInstant, now)
        );
      })
      .sort((a, b) => {
        const aCompleted = isCompletedStatus(normalizeBookingStatusKey(a.status)) ? 1 : 0;
        const bCompleted = isCompletedStatus(normalizeBookingStatusKey(b.status)) ? 1 : 0;
        if (aCompleted !== bCompleted) return bCompleted - aCompleted;
        return safeSortByCreatedAtDesc(a, b);
      })
      .slice(0, 12);
  }, [bookings]);

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this service record?')) return;
    setActionMessage(null);
    setCancellingId(bookingId);
    try {
      const userId = resolveCustomerUserId(user?.id);
      if (!userId) {
        setActionMessage('Sign in required to cancel this service record.');
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Customer requested cancellation', refund_requested: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to cancel service record (${res.status})`);
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: String(json?.booking?.status || json?.status || 'cancelled') }
            : b
        )
      );
      setActionMessage(json?.message || 'Service record cancelled');
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to cancel service record');
    } finally {
      setCancellingId(null);
    }
  };

  const loadBookingMedia = async (bookingId: string) => {
    const userId = resolveCustomerUserId(user?.id);
    if (!userId) {
      setMediaByBooking((prev) => ({
        ...prev,
        [bookingId]: { loading: false, error: 'Sign in required to load media.', total: null, loaded: false, imageCount: 0 },
      }));
      return;
    }
    setMediaByBooking((prev) => ({
      ...prev,
      [bookingId]: {
        loading: true,
        error: null,
        total: prev[bookingId]?.total ?? null,
        loaded: prev[bookingId]?.loaded ?? false,
        imageCount: prev[bookingId]?.imageCount ?? 0,
      },
    }));
    try {
      const res = await fetch(`/api/bookings/${bookingId}/media`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load service-record media (${res.status})`);
      }
      const total = Array.isArray(json?.assets) ? json.assets.length : 0;
      const imageCount = Array.isArray(json?.images) ? json.images.length : 0;
      const videos: BookingProofVideo[] = Array.isArray(json?.videos)
        ? json.videos.map((v: {
            id?: unknown;
            title?: unknown;
            downloadUrl?: unknown;
            mediaSessionId?: unknown;
            isPrimaryProofVideo?: unknown;
            createdAt?: unknown;
          }) => ({
            id: String(v.id),
            title: String(v.title || 'Service Video'),
            downloadUrl: v.downloadUrl ? String(v.downloadUrl) : null,
            mediaSessionId: v.mediaSessionId ? String(v.mediaSessionId) : null,
            isPrimaryProofVideo: Boolean(v.isPrimaryProofVideo),
            createdAt: v.createdAt ? String(v.createdAt) : null,
          }))
        : [];
      const rawAssets = Array.isArray(json?.assets) ? json.assets : [];
      const lastSharedAtCandidate = rawAssets
        .map((asset: any) => String(asset?.createdAt || asset?.moderatedAt || ''))
        .find((value: string) => value && !Number.isNaN(new Date(value).getTime())) || null;
      const recentThresholdMs = 1000 * 60 * 60 * 24 * 2;
      const recentlyUpdated = Boolean(
        lastSharedAtCandidate && Date.now() - new Date(lastSharedAtCandidate).getTime() <= recentThresholdMs
      );
      setMediaByBooking((prev) => ({
        ...prev,
        [bookingId]: { loading: false, error: null, total, loaded: true, imageCount, videos },
      }));
      setProofSignalByBooking((prev) => ({
        ...prev,
        [bookingId]: {
          loading: false,
          hasSharedProof: total > 0,
          lastSharedAt: lastSharedAtCandidate,
          recentlyUpdated,
        },
      }));
    } catch (e) {
      setMediaByBooking((prev) => ({
        ...prev,
        [bookingId]: {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load media',
          total: null,
          loaded: false,
          imageCount: 0,
        },
      }));
      setProofSignalByBooking((prev) => ({
        ...prev,
        [bookingId]: {
          loading: false,
          hasSharedProof: false,
          lastSharedAt: null,
          recentlyUpdated: false,
        },
      }));
    }
  };

  useEffect(() => {
    const userId = resolveCustomerUserId(user?.id);
    if (!userId || proofCandidates.length === 0) return;
    const candidates = proofCandidates;
    for (const booking of candidates) {
      const bookingId = String(booking.id);
      if (proofSignalByBooking[bookingId]?.loading || proofSignalByBooking[bookingId]) continue;
      setProofSignalByBooking((prev) => ({
        ...prev,
        [bookingId]: {
          loading: true,
          hasSharedProof: false,
          lastSharedAt: null,
          recentlyUpdated: false,
        },
      }));
      void loadBookingMedia(bookingId);
    }
  }, [proofCandidates, user?.id, proofSignalByBooking]);

  const listNow = new Date();
  return (
    <div className="min-h-full">
      <div className="pt-6 space-y-4">
        <div className="reliance-operator-hero mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
              Customer service timeline
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">
                My Service Records
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                Track scheduled work, open approved service videos, and follow each service record in one clear timeline.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLike onClick={fetchBookings} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </ButtonLike>
            <Link
              href="/discover"
                      title="Explore provider proof"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
                      Explore Proof
            </Link>
          </div>
        </div>

        <div className="mb-10 rounded-[26px] border border-blue-500/20 bg-blue-50/90 p-5 text-sm shadow-[0_18px_55px_rgba(4,10,22,0.24)]">
          <div className="flex gap-2">
            <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium text-gray-900">Service updates appear here</p>
              <p className="text-gray-700">
                Completed services and approved Service Videos appear here. Open a record to watch your video or leave a review.
              </p>
            </div>
          </div>
        </div>

        <div className="reliance-operator-surface mb-10 rounded-[28px] p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="w-full md:w-96 space-y-1">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search service, vendor, title, or reference ID"
                aria-describedby="my-bookings-search-hint"
                className="border rounded px-3 py-2 text-sm w-full"
              />
              <p id="my-bookings-search-hint" className="text-xs text-gray-500">
                Matches the service, vendor, title, or reference ID.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['upcoming', 'past', 'archived', 'needs_follow_up', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-sm border ${
                    activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {tab === 'past'
                    ? 'Completed'
                    : tab === 'archived'
                      ? 'Archived'
                    : tab === 'needs_follow_up'
                      ? 'Needs Follow-Up'
                      : tab[0].toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
                </button>
              ))}
            </div>
          </div>
        </div>

        {actionMessage ? (
          <div className="text-sm rounded border border-blue-200 bg-blue-50 text-blue-800 p-4 mb-10">
            {actionMessage}
          </div>
        ) : null}

        {authLoading ? (
          <PanelText text="Checking your session..." />
        ) : !resolveCustomerUserId(user?.id) ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 space-y-2">
            <p className="font-medium">Sign in to see your services</p>
            <p className="text-amber-800">We could not find a customer id in your session. Use the same account you use for services on Reliance.</p>
            <Link href="/auth/login" className="inline-block text-blue-700 font-medium underline">
              Go to sign in
            </Link>
          </div>
        ) : loading ? (
          <PanelText text="Loading your services..." />
        ) : error ? (
          <div className="space-y-3">
            <PanelText text={error} danger />
            {/unauthorized|sign in/i.test(error) ? (
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-blue-700 font-medium underline">
                  Sign in
                </Link>
              </div>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <PanelText
            text={
              activeTab === 'needs_follow_up'
                ? 'No follow-up services found.'
                : activeTab === 'past'
                  ? 'No completed services found.'
                  : activeTab === 'archived'
                    ? 'No archived services found.'
                  : `No ${activeTab} services found.`
            }
            hint={
              activeTab === 'upcoming' && tabCounts.needs_follow_up > 0
                ? 'Services that passed their scheduled date without a completed closeout are listed under Needs Follow-Up.'
                : activeTab === 'upcoming' && tabCounts.past > 0
                  ? 'Completed work is available under Completed.'
                  : activeTab === 'upcoming' && tabCounts.archived > 0
                    ? 'Older retained records are listed under Archived.'
                  : activeTab === 'needs_follow_up'
                    ? 'These are services whose scheduled date passed without a completed vendor closeout.'
                    : activeTab === 'archived'
                    ? 'These are older retained service records kept for reference.'
                  : 'Try another tab or explore provider proof.'
            }
          />
        ) : (
          <div className="space-y-3 mb-10">
            {activeTab === 'archived' ? (
              <div className="rounded-md border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-800">
                These are older retained service records kept for reference.
              </div>
            ) : null}
            {activeTab === 'needs_follow_up' ? (
              <div className="rounded-md border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                These services passed their scheduled date without a completed vendor closeout.
              </div>
            ) : null}
            {filtered.map((booking) => {
              const mediaState = mediaByBooking[booking.id];
              const proofSignal = proofSignalByBooking[booking.id];
              const proofLikelyReady = Boolean(proofSignal?.hasSharedProof);
              const statusKey = normalizeBookingStatusKey(booking.status);
              const archivedRecord = isArchivedStatus(statusKey);
              const completedRecord = isCompletedStatus(statusKey);
              const customerLifecycle = booking.customer_lifecycle || null;
              const lifecycleVideoState = customerLifecycle?.videoState || null;
              const reviewSubmitted = customerLifecycle?.reviewSubmitted === true;
              const reviewEligible = customerLifecycle?.reviewEligible === true;
              const reviewSubmittedWithoutEligibleVideo =
                customerLifecycle?.reviewSubmittedWithoutEligibleVideo === true;
              const customerVisibleCompletedVideo =
                customerLifecycle?.videoAvailableToCustomer === true;
              const completedVideoPendingApproval =
                customerLifecycle?.videoPendingApproval === true ||
                lifecycleVideoState === 'pending_approval';
              const { instant: scheduleInstant } = resolveBookingScheduleInstant(
                booking.booking_date,
                booking.booking_time,
                booking.created_at
              );
              const cancelState = classifyCancelBookingAction({
                statusKey,
                scheduleInstant,
                now: listNow,
              });
              const vendorIdOk = Boolean((booking.vendor_id || '').trim());
              const mediaButtonDisabled = !vendorIdOk || Boolean(mediaState?.loading);
              const mediaButtonTitle = !vendorIdOk
                ? 'Vendor information is required on this record before shared media can load.'
                : mediaState?.loading
                  ? 'Loading service videos...'
                  : undefined;
              const serviceDetailHref = booking.service.id ? `/service/${booking.service.id}` : null;
              const bookingProofHref = `/my-bookings/${booking.id}`;
              const reviewCaptureOk = !archivedRecord && shouldEnableReviewCaptureForStatus(statusKey);
              const activeWorkflowRecord =
                statusKey === 'pending' ||
                statusKey === 'confirmed' ||
                statusKey === 'in_progress' ||
                statusKey === 'in progress' ||
                statusKey === 'awaiting_review' ||
                statusKey === 'awaiting review';
              const mediaLoaded = Boolean(mediaState?.loaded);
              const showMediaCheckButton =
                archivedRecord ||
                completedRecord ||
                activeTab === 'needs_follow_up' ||
                proofLikelyReady ||
                mediaLoaded ||
                Boolean(mediaState?.error);
              const mediaTotal = mediaState?.total;
              const mediaButtonLabel = mediaState?.loading
                ? 'Checking videos...'
                : mediaLoaded
                  ? typeof mediaTotal === 'number' && mediaTotal > 0
                    ? archivedRecord
                      ? 'Refresh retained media'
                      : 'Refresh shared videos'
                    : archivedRecord
                      ? 'Check again for retained media'
                      : 'Check again for shared videos'
                  : archivedRecord
                    ? 'Check for retained media'
                    : 'Check for shared videos';
              const videoList = mediaState?.videos ?? [];
              const imageCount = mediaState?.imageCount ?? 0;
              const primaryProofVideo = videoList.find((video) => Boolean(video.isPrimaryProofVideo)) || null;
              const scheduledDateText =
                formatDisplayDate(booking.booking_date, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }) || booking.booking_date || 'Not set';
              const scheduledTimeText = formatDisplayTime(booking.booking_time) || booking.booking_time || 'Not set';
              const hasSharedVideoPublished =
                mediaLoaded && videoList.some((v) => Boolean(v.downloadUrl && v.mediaSessionId));
              const hasSharedMediaNoVideo =
                mediaLoaded &&
                typeof mediaTotal === 'number' &&
                mediaTotal > 0 &&
                videoList.length === 0;
              const mediaErrorHint = mediaState?.error ? mediaHintForError(mediaState.error) : null;
              const shouldOpenBookingDetailFirst =
                archivedRecord ||
                activeTab === 'past' ||
                activeTab === 'needs_follow_up' ||
                hasSharedVideoPublished ||
                hasSharedMediaNoVideo ||
                (mediaLoaded && typeof mediaTotal === 'number' && mediaTotal === 0);
              const primaryBookingActionLabel = archivedRecord
                ? 'Open service record'
                : activeTab === 'needs_follow_up'
                  ? 'Open service-record status'
                  : activeTab === 'past' && customerVisibleCompletedVideo
                    ? 'Open service video'
                  : activeTab === 'past'
                    ? 'Open service record'
                    : hasSharedMediaNoVideo
                      ? 'Open service-record media status'
                      : 'Open service-record detail';

              if (activeTab === 'past' && completedRecord) {
                return (
                  <div
                    key={booking.id}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    data-testid={`my-bookings-row-${booking.id}`}
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Service</p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">{booking.service.name}</h2>
                        <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Vendor:</span> {booking.vendor.name}</p>
                        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                          <p><span className="font-medium text-slate-500">Status:</span> Completed</p>
                          <p><span className="font-medium text-slate-500">Service Video:</span> {customerVisibleCompletedVideo ? 'Ready' : completedVideoPendingApproval ? 'Pending approval' : 'Not available'}</p>
                          <p><span className="font-medium text-slate-500">Review:</span> {reviewSubmitted ? 'Reviewed' : reviewEligible ? 'Leave a review' : 'Not available'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Link
                          href={bookingProofHref}
                          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          View Service Record
                        </Link>
                        {reviewEligible && !reviewSubmitted ? (
                          <Link
                            href={`${bookingProofHref}#your-review`}
                            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Leave a review
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">Reference: <span className="font-mono">{booking.id}</span></p>
                  </div>
                );
              }

              return (
                <div
                  key={booking.id}
                  className="bg-white border rounded-lg p-4 mb-4"
                  data-testid={`my-bookings-row-${booking.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{booking.service.name}</p>
                      <p className="text-sm text-gray-600">Vendor: {booking.vendor.name}</p>
                      <p className="text-sm text-gray-600">
                        Reference ID: <span className="font-mono text-xs">{booking.id}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Keep this handy if you contact support.
                      </p>
                      {booking.title ? <p className="text-sm text-gray-600">Title: {booking.title}</p> : null}
                      {proofSignal?.hasSharedProof ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800">Shared media available</Badge>
                          {proofSignal.recentlyUpdated ? (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                              Recently updated
                            </Badge>
                          ) : null}
                          {proofSignal.lastSharedAt ? (
                            <span className="text-xs text-gray-600">
                              Shared {new Date(proofSignal.lastSharedAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {activeTab === 'past' && completedRecord && customerLifecycle ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {customerVisibleCompletedVideo ? (
                            <Badge className="bg-blue-100 text-blue-800">Completed video available</Badge>
                          ) : completedVideoPendingApproval ? (
                            <Badge className="bg-amber-100 text-amber-900">Video pending approval</Badge>
                          ) : lifecycleVideoState === 'rejected' || lifecycleVideoState === 'approved_not_customer_visible' ? (
                            <Badge className="bg-slate-100 text-slate-800">Completed video unavailable</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-800">Completed video not submitted</Badge>
                          )}
                          {reviewSubmitted ? (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                              Review on file
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-sm text-right">
                      <p className="text-gray-600">
                        Status:{' '}
                        {formatMyBookingsStatusDisplay(booking.status, {
                          scheduleInstant,
                          now: listNow,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                      <span>
                        <span className="text-gray-500">Scheduled date: </span>
                        {scheduledDateText}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                      <span>
                        <span className="text-gray-500">Time: </span>
                        {scheduledTimeText}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-800">
                    <p className="font-medium text-gray-900 mb-1">Next steps</p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {shouldOpenBookingDetailFirst ? (
                        <li>
                          <Link href={bookingProofHref} className="text-blue-700 font-medium underline">
                            {primaryBookingActionLabel}
                          </Link>
                        </li>
                      ) : serviceDetailHref ? (
                        <li>
                          <Link href={serviceDetailHref} className="text-blue-700 font-medium underline">
                            View service details in the catalog
                          </Link>
                        </li>
                      ) : (
                        <li>Service details are unavailable for this row.</li>
                      )}
                      <li>
                        <strong>Shared service updates:</strong>{' '}
                        {archivedRecord && hasSharedVideoPublished
                          ? primaryProofVideo
                            ? 'Retained service video is available on the service-record detail page for reference.'
                            : 'Retained media is available on the service-record detail page for reference.'
                          : archivedRecord && hasSharedMediaNoVideo
                            ? `This archived record keeps ${mediaTotal} retained file(s)${
                                imageCount > 0 ? ` (${imageCount} image${imageCount === 1 ? '' : 's'})` : ''
                              } for reference.`
                            : archivedRecord && mediaLoaded && mediaTotal === 0
                              ? 'No retained media is attached to this archived record.'
                              : archivedRecord && !mediaState?.error
                                ? 'Use the service-record detail page to check whether any retained media is attached to this archived record.'
                        : hasSharedVideoPublished
                          ? primaryProofVideo
                            ? 'Your approved Private Proof package is ready on the Service Record detail page.'
                          : 'Shared media is ready on the service-record detail page. A completed work video has not been published yet.'
                        : activeTab === 'past' && completedRecord && customerLifecycle
                          ? customerVisibleCompletedVideo
                            ? 'Service completed. The approved Private Proof package is available on the Service Record.'
                            : completedVideoPendingApproval
                              ? 'Service completed. The Service Video package is awaiting Reliance Audit.'
                              : lifecycleVideoState === 'rejected'
                                ? 'Service completed. The submitted Service Video package did not pass Reliance Audit.'
                                : lifecycleVideoState === 'approved_not_customer_visible'
                                ? 'Service completed. Private Proof is not currently available.'
                                  : 'Service completed. An approved Private Proof package is not available yet.'
                          : activeWorkflowRecord
                            ? statusKey === 'awaiting_review' || statusKey === 'awaiting review'
                              ? 'Service work is complete and awaiting final review. Customer-visible service videos or images appear here after review and approval.'
                              : statusKey === 'in_progress' || statusKey === 'in progress'
                                ? 'Service is in progress. Customer-visible service videos or images appear here after the work is completed and approved.'
                                : 'Service is scheduled. Customer-visible service videos or images appear here after the work is completed and approved.'
                          : hasSharedMediaNoVideo
                            ? `Your vendor shared ${mediaTotal} approved file(s), but none are video this page can play${
                                imageCount > 0 ? ` (${imageCount} image${imageCount === 1 ? '' : 's'})` : ''
                              }.`
                            : mediaState?.loading
                              ? reviewCaptureOk
                                ? 'Checking whether approved service media is ready on the service-record detail page.'
                                : 'Checking whether approved media is ready on the service-record detail page.'
                            : !mediaLoaded && proofLikelyReady
                              ? 'Approved service video is already attached. Open the service-record detail page to continue into the service media flow.'
                            : mediaLoaded && mediaTotal === 0
                              ? reviewCaptureOk
                                ? 'An approved Private Proof package is not currently attached to this completed Service Record. Open it to confirm the current video and review state.'
                                : 'No approved media is available yet. Your vendor may still be uploading, or items may still be in review.'
                              : mediaState?.error
                                ? 'Could not load the list. See the message under the button.'
                                : 'Use View service videos to load approved items your vendor has shared.'}
                      </li>
                      <li>
                        <strong>Review:</strong>{' '}
                        {archivedRecord
                          ? 'This archived record is kept for reference. New review prompts are no longer active here.'
                          : activeTab === 'past' && completedRecord && customerLifecycle
                            ? reviewSubmittedWithoutEligibleVideo
                              ? 'A review is already on file, but an approved Private Proof package is not currently available.'
                              : reviewSubmitted
                                ? 'Your review is already on file for this completed service record.'
                                : reviewEligible
                                ? 'Open the completed Service Record to watch the Service Video or leave your review.'
                                  : completedVideoPendingApproval
                                    ? 'Review opens after the Service Video package passes Reliance Audit and Private Proof is released.'
                                    : 'Review opens when approved Private Proof is available for this completed service.'
                          : activeWorkflowRecord
                            ? statusKey === 'awaiting_review' || statusKey === 'awaiting review'
                              ? 'Review opens after the Service Video package passes Reliance Audit and Private Proof is released.'
                              : 'Review is not open yet. It becomes available after the service is complete and approved Private Proof is available.'
                          : mediaState?.loading && reviewCaptureOk
                            ? 'We are checking whether this Service Record has approved Private Proof and is ready for review.'
                          : reviewCaptureOk
                            ? hasSharedVideoPublished
                              ? 'Open the completed Service Record to watch the Service Video or leave your review.'
                            : !mediaLoaded && proofLikelyReady
                                ? 'Open the Service Record to view approved Private Proof and the review option.'
                              : 'Review opens for a completed service with active approved Private Proof. A historical review may remain on file even when playback is no longer available here.'
                            : 'Not offered for cancelled services.'}
                      </li>
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {cancelState.mode === 'hidden' ? null : (
                      <button
                        type="button"
                        disabled={cancelState.mode === 'disabled' || cancellingId === booking.id}
                        title={cancelState.mode === 'disabled' ? cancelState.reason : undefined}
                        onClick={() => {
                          if (cancelState.mode !== 'enabled') return;
                          void cancelBooking(booking.id);
                        }}
                        className="px-3 py-2 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Service Record'}
                      </button>
                    )}
                    {cancelState.mode === 'disabled' && cancelState.reason ? (
                      <span className="text-xs text-gray-600 max-w-xs">{cancelState.reason}</span>
                    ) : null}
                    {activeTab === 'needs_follow_up' ? (
                      <Link
                        href={customerHelpHref}
                        className="px-3 py-2 rounded border border-blue-300 text-blue-700 text-sm hover:bg-blue-50"
                      >
                        Open Help Center
                      </Link>
                    ) : null}
                    {archivedRecord ? (
                      <Link
                        href={customerHelpHref}
                        className="px-3 py-2 rounded border border-blue-300 text-blue-700 text-sm hover:bg-blue-50"
                      >
                        Open Help Center
                      </Link>
                    ) : null}
                    {showMediaCheckButton ? (
                      <button
                        type="button"
                        disabled={mediaButtonDisabled}
                        title={mediaButtonTitle}
                        onClick={() => {
                          if (mediaButtonDisabled) return;
                          void loadBookingMedia(booking.id);
                        }}
                        className="px-3 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {mediaButtonLabel}
                      </button>
                    ) : null}
                      {mediaLoaded && typeof mediaTotal === 'number' && mediaTotal > 0 ? (
                        <Link
                          href={bookingProofHref}
                          className="px-3 py-2 rounded border border-blue-300 text-blue-700 text-sm hover:bg-blue-50"
                        >
                        {archivedRecord
                          ? 'Open retained media'
                          : customerVisibleCompletedVideo
                            ? 'Open service video'
                            : 'Open service-record media'}
                      </Link>
                    ) : null}
                    {showMediaCheckButton && mediaState?.loading ? (
                      <span className="text-xs text-gray-500">Loading service videos...</span>
                    ) : null}
                    {mediaLoaded && typeof mediaTotal === 'number' && mediaTotal > 0 ? (
                      <span className="text-xs font-medium text-green-800">
                        {mediaTotal} item{mediaTotal === 1 ? '' : 's'} from your vendor, approved for you to view
                      </span>
                    ) : null}
                    {mediaState?.error ? (
                      <div className="text-xs text-red-700 space-y-0.5 w-full basis-full">
                        <span>{mediaState.error}</span>
                        {mediaErrorHint ? <p className="text-gray-700">{mediaErrorHint}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  {hasSharedMediaNoVideo ? (
                    <div className="mt-3 rounded-md border border-amber-100 bg-amber-50/90 px-3 py-2 text-xs text-gray-900">
                      <p className="font-medium text-amber-950">Shared files (no playable video here)</p>
                      <p className="mt-1 text-gray-800">
                        Reliance only embeds video on this page. Your approved items may be images or other types. Ask your
                        vendor if you need a different format.
                      </p>
                    </div>
                  ) : null}
                  {videoList.length > 0 ? (
                    <div className="mt-3 rounded border bg-gray-50 p-3">
                      <p className="mb-1 text-sm font-medium text-gray-900">
                        {archivedRecord ? 'Retained service videos' : 'Shared service videos from your vendor'}
                      </p>
                      <p className="mb-2 text-xs text-gray-600">
                        {archivedRecord
                          ? 'These files are kept with the archived record for reference. Open the service-record detail page to review them in the full timeline experience.'
                          : 'These files are approved and customer-visible. Open the Service Record to watch the complete Private Proof package.'}
                      </p>
                      {primaryProofVideo ? (
                        <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                          <strong>{archivedRecord ? 'Featured retained video available:' : 'Featured video available:'}</strong>{' '}
                          {archivedRecord ? 'open this archived service record to review the retained record.' : 'open this service record to review completed work.'}
                        </div>
                      ) : (
                        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                          {archivedRecord
                            ? <><strong>No retained featured video.</strong> If archived media exists, it will appear here for reference.</>
                            : <><strong>No approved Service Video package yet.</strong> Open the Service Record for its current status.</>}
                        </div>
                      )}
                      <div className="mb-3 flex flex-wrap gap-2">
                        {videoList.map((video) => (
                          <Badge
                            key={video.id}
                            variant="outline"
                            className={video.isPrimaryProofVideo ? 'border-emerald-300 text-emerald-800' : 'border-gray-300 text-gray-700'}
                          >
                            {video.title}
                            {video.isPrimaryProofVideo ? ' - Featured video' : ''}
                          </Badge>
                        ))}
                      </div>
                      <Link
                        href={bookingProofHref}
                        className="inline-flex rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                      >
                        {archivedRecord ? 'Open retained media' : 'Open service videos'}
                      </Link>
                    </div>
                  ) : null}
                  {mediaLoaded &&
                  mediaTotal === 0 &&
                  !mediaState?.error &&
                  !archivedRecord &&
                  activeTab !== 'needs_follow_up' ? (
                    <p className="mt-3 text-xs text-gray-600">
                      No approved media matched this service yet. That can change when your vendor publishes new files.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelText({ text, danger = false, hint }: { text: string; danger?: boolean; hint?: string }) {
  return (
    <div className={`rounded border px-4 py-8 text-center text-sm ${danger ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'}`}>
      <p>{text}</p>
      {hint ? <p className="mt-2 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function ButtonLike({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: import('react').ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
