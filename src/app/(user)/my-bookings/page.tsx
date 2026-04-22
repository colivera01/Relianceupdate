'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { SmartVideoPlayer } from '@/components/reviews/SmartVideoPlayer';
import { useAuth } from '@/contexts/AuthContext';
import {
  bookingMatchesSearch,
  bookingMatchesTab,
  classifyCancelBookingAction,
  formatMyBookingsStatusDisplay,
  normalizeBookingStatusKey,
  resolveBookingScheduleInstant,
  sanitizeMyBookingsRow,
  safeSortByCreatedAtDesc,
  shouldEnableReviewCaptureForStatus,
  type MyBookingsRow,
} from '@/lib/my-bookings';
import { resolveCustomerUserId } from '@/lib/customer-user-id';

type MediaState = {
  loading: boolean;
  error: string | null;
  total: number | null;
  /** True after a successful GET (even when total is 0). Used for truthful empty vs not-yet-loaded. */
  loaded: boolean;
  /** Count of image assets returned (GET includes approved customer-visible images). */
  imageCount?: number;
  videos?: Array<{
    id: string;
    title: string;
    blobUrl: string | null;
    mediaSessionId: string | null;
  }>;
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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [mediaByBooking, setMediaByBooking] = useState<Record<string, MediaState>>({});
  const [activeVideoByBooking, setActiveVideoByBooking] = useState<Record<string, string>>({});

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
      const query = new URLSearchParams();
      query.set('userId', userId);

      const res = await fetch(`/api/bookings?${query.toString()}`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
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

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    setActionMessage(null);
    setCancellingId(bookingId);
    try {
      const userId = resolveCustomerUserId(user?.id);
      if (!userId) {
        setActionMessage('Sign in required to cancel a booking.');
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({ reason: 'Customer requested cancellation', refund_requested: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to cancel booking (${res.status})`);
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: String(json?.booking?.status || json?.status || 'cancelled') }
            : b
        )
      );
      setActionMessage(json?.message || 'Booking cancelled');
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to cancel booking');
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
        headers: {
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load booking media (${res.status})`);
      }
      const total = Array.isArray(json?.assets) ? json.assets.length : 0;
      const imageCount = Array.isArray(json?.images) ? json.images.length : 0;
      const videos = Array.isArray(json?.videos)
        ? json.videos.map((v: { id?: unknown; title?: unknown; blobUrl?: unknown; mediaSessionId?: unknown }) => ({
            id: String(v.id),
            title: String(v.title || 'Service Video'),
            blobUrl: v.blobUrl ? String(v.blobUrl) : null,
            mediaSessionId: v.mediaSessionId ? String(v.mediaSessionId) : null,
          }))
        : [];
      setMediaByBooking((prev) => ({
        ...prev,
        [bookingId]: { loading: false, error: null, total, loaded: true, imageCount, videos },
      }));
      if (videos.length > 0) {
        setActiveVideoByBooking((prev) => ({
          ...prev,
          [bookingId]: prev[bookingId] || videos[0].id,
        }));
      }
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
    }
  };

  const listNow = new Date();
  const customerUserIdForReview = resolveCustomerUserId(user?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              Your history with vendors on Reliance—scheduled visits, status, and media they share for transparency.
              Vendors add recordings after work; you only see items that are approved for customers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLike onClick={fetchBookings} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </ButtonLike>
            <Link
              href="/discover"
              title="Browse services to book (Discover)"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Book New Service
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/90 px-4 py-3 text-sm text-gray-800">
          <div className="flex gap-2">
            <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" aria-hidden />
            <div className="space-y-2">
              <p className="font-medium text-gray-900">Why a row appears here</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li>Each entry links your account to a catalog service and vendor (your engagement on Reliance).</li>
                <li>
                  Use <strong>Show shared media</strong> to load video or images your vendor has already published for
                  you—this list only includes media that passed review and is marked visible to customers.
                </li>
                <li>
                  When playback is available and your service isn&apos;t cancelled, you may get in-player prompts to leave
                  quick feedback after watching.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="w-full md:w-96 space-y-1">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search service, vendor, title, client name, or booking ID"
                aria-describedby="my-bookings-search-hint"
                className="border rounded px-3 py-2 text-sm w-full"
              />
              <p id="my-bookings-search-hint" className="text-xs text-gray-500">
                Matches service name, vendor name, title, client name on the record, or your reference ID.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-sm border ${
                    activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {actionMessage ? (
          <div className="text-sm rounded border border-blue-200 bg-blue-50 text-blue-800 px-3 py-2">
            {actionMessage}
          </div>
        ) : null}

        {authLoading ? (
          <PanelText text="Checking your session…" />
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
            text={`No ${activeTab} services found.`}
            hint="Try another tab or book a service from Discover."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => {
              const mediaState = mediaByBooking[booking.id];
              const statusKey = normalizeBookingStatusKey(booking.status);
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
                  ? 'Loading shared media…'
                  : undefined;
              const serviceDetailHref = booking.service.id ? `/service/${booking.service.id}` : null;
              const reviewCaptureOk = shouldEnableReviewCaptureForStatus(statusKey);
              const mediaLoaded = Boolean(mediaState?.loaded);
              const mediaTotal = mediaState?.total;
              const videoList = mediaState?.videos ?? [];
              const imageCount = mediaState?.imageCount ?? 0;
              const hasPlayableSharedVideo =
                mediaLoaded && videoList.some((v) => Boolean(v.blobUrl && v.mediaSessionId));
              const hasSharedMediaNoVideo =
                mediaLoaded &&
                typeof mediaTotal === 'number' &&
                mediaTotal > 0 &&
                videoList.length === 0;
              const mediaErrorHint = mediaState?.error ? mediaHintForError(mediaState.error) : null;

              return (
                <div
                  key={booking.id}
                  className="bg-white border rounded-lg p-4"
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
                        Use this ID if you contact support; it matches your booking record in Reliance.
                      </p>
                      {booking.title ? <p className="text-sm text-gray-600">Title: {booking.title}</p> : null}
                    </div>
                    <div className="text-sm text-right">
                      <p className="font-semibold text-gray-900">${Number(booking.total_price || 0).toFixed(2)}</p>
                      <p className="text-gray-600">Status: {formatMyBookingsStatusDisplay(booking.status)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                      <span>
                        <span className="text-gray-500">Scheduled date: </span>
                        {booking.booking_date || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                      <span>
                        <span className="text-gray-500">Time: </span>
                        {booking.booking_time || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-800">
                    <p className="font-medium text-gray-900 mb-1">What you can do</p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {serviceDetailHref ? (
                        <li>
                          <Link
                            href={serviceDetailHref}
                            className="text-blue-700 font-medium underline inline-flex items-center gap-1"
                          >
                            View service details
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                          </Link>{' '}
                          in the catalog.
                        </li>
                      ) : (
                        <li>Service details link unavailable for this row (missing catalog id).</li>
                      )}
                      <li>
                        <strong>Shared media:</strong>{' '}
                        {hasPlayableSharedVideo
                          ? 'Available below—play a clip to watch what your vendor shared.'
                          : hasSharedMediaNoVideo
                            ? `Your vendor shared ${mediaTotal} approved file(s) for you, but none are video this page can play${
                                imageCount > 0 ? ` (${imageCount} image${imageCount === 1 ? '' : 's'})` : ''
                              }.`
                            : mediaLoaded && mediaTotal === 0
                              ? 'None loaded yet for you to view. Your vendor may still be uploading, or items may still be in review before they appear for customers.'
                              : mediaState?.error
                                ? 'Could not load the list—see the message under the button.'
                                : 'Tap “Show shared media” to load items your vendor has published for customers (approved in Reliance).'}
                      </li>
                      <li>
                        <strong>Review:</strong>{' '}
                        {reviewCaptureOk
                          ? hasPlayableSharedVideo
                            ? 'After playback starts, watch for on-video prompts to leave quick feedback.'
                            : 'When shared video is available and you play it, you may be prompted for quick feedback.'
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
                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    )}
                    {cancelState.mode === 'disabled' && cancelState.reason ? (
                      <span className="text-xs text-gray-600 max-w-xs">{cancelState.reason}</span>
                    ) : null}
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
                      Show shared media
                    </button>
                    {mediaState?.loading ? (
                      <span className="text-xs text-gray-500">Loading shared media…</span>
                    ) : null}
                    {mediaLoaded && typeof mediaTotal === 'number' && mediaTotal > 0 ? (
                      <span className="text-xs font-medium text-green-800">
                        {mediaTotal} item{mediaTotal === 1 ? '' : 's'} from your vendor — approved for you to view
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
                      <p className="font-medium text-amber-950">Shared media (no video for this player)</p>
                      <p className="mt-1 text-gray-800">
                        Reliance only embeds video on this page. Your approved items may be images or other types—ask your
                        vendor if you need a different format.
                      </p>
                    </div>
                  ) : null}
                  {videoList.length > 0 ? (
                    <div className="mt-3 rounded border bg-gray-50 p-3">
                      <p className="mb-1 text-sm font-medium text-gray-900">Shared media from your vendor</p>
                      <p className="mb-2 text-xs text-gray-600">
                        These files are visible to you because your vendor shared them and they are approved for
                        customers. Use the player for playback; review prompts may appear for eligible visits.
                      </p>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {videoList.map((video) => (
                          <button
                            type="button"
                            key={video.id}
                            onClick={() => setActiveVideoByBooking((prev) => ({ ...prev, [booking.id]: video.id }))}
                            className={`rounded border px-2 py-1 text-xs ${
                              activeVideoByBooking[booking.id] === video.id
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-gray-300 bg-white text-gray-700'
                            }`}
                          >
                            {video.title}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const activeVideoId = activeVideoByBooking[booking.id];
                        const video = videoList.find((v) => v.id === activeVideoId) || videoList[0];
                        if (!video || !video.blobUrl || !video.mediaSessionId) {
                          return <p className="text-xs text-gray-500">Video playback unavailable for this media asset.</p>;
                        }
                        if (!vendorIdOk) {
                          return (
                            <p className="text-xs text-gray-500">
                              Playback and review prompts need vendor information on this record. Shared media cannot load
                              until that data is present.
                            </p>
                          );
                        }
                        return (
                          <SmartVideoPlayer
                            src={video.blobUrl}
                            bookingId={booking.id}
                            vendorId={booking.vendor_id}
                            mediaSessionId={video.mediaSessionId}
                            reviewCaptureEnabled={shouldEnableReviewCaptureForStatus(statusKey)}
                            userId={customerUserIdForReview ?? undefined}
                          />
                        );
                      })()}
                    </div>
                  ) : null}
                  {mediaLoaded && mediaTotal === 0 && !mediaState?.error ? (
                    <p className="mt-3 text-xs text-gray-600">
                      No approved customer-visible media matched this engagement yet. That can change when your vendor
                      publishes new files.
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
