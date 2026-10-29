'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate, formatDisplayTime } from '@/lib/date-display';
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  Download,
  Share2,
  Home,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';

type CustomerMetadata = {
  user_notes?: string;
  client_email?: string;
  client_phone?: string;
  custom_fields?: Record<string, unknown>;
  service_request?: {
    state?: string;
    requested_at?: string;
    requested_scheduled_for?: string | null;
    response_reason?: string | null;
    proposed_scheduled_for?: string | null;
  };
} | null;

type BookingContract = {
  id: string;
  user_id: string;
  vendor_id: string;
  service_id: string;
  title: string | null;
  client_name: string | null;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
  total_price: number;
  created_at: string;
  updated_at: string;
  customer_metadata?: CustomerMetadata;
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
  } | null;
  vendor: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    location: string | null;
  } | null;
};

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function requestStatePresentation(stateValue: unknown, bookingStatus: unknown) {
  const normalized = String(stateValue || bookingStatus || 'PENDING').trim().toUpperCase();
  if (normalized === 'VENDOR_ACCEPTED' || normalized === 'CONFIRMED') {
    return { label: 'Accepted by business', tone: 'bg-emerald-100 text-emerald-800', accepted: true };
  }
  if (normalized === 'SCHEDULED') {
    return { label: 'Scheduled', tone: 'bg-emerald-100 text-emerald-800', accepted: true };
  }
  if (normalized === 'COUNTEROFFERED') {
    return { label: 'New time proposed', tone: 'bg-amber-100 text-amber-900', accepted: false };
  }
  if (normalized === 'VENDOR_DECLINED') {
    return { label: 'Declined by business', tone: 'bg-rose-100 text-rose-800', accepted: false };
  }
  if (normalized === 'CUSTOMER_DECLINED' || normalized === 'CANCELED' || normalized === 'CANCELLED') {
    return { label: 'Cancelled', tone: 'bg-slate-200 text-slate-800', accepted: false };
  }
  return { label: 'Request sent · awaiting response', tone: 'bg-blue-100 text-blue-800', accepted: false };
}

function BookingConfirmationPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const serviceId = String(params?.serviceId ?? "");
  const bookingId = searchParams?.get("bookingId") ?? null;

  const [booking, setBooking] = useState<BookingContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setError('Missing service-record ID. Please request the service again.');
      setLoading(false);
      setBooking(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load service record (${response.status})`);
      }
      if (!payload?.booking?.id) {
        throw new Error('Service-record data is missing from API response');
      }
      setBooking(payload.booking as BookingContract);
    } catch (err) {
      setBooking(null);
      setError(err instanceof Error ? err.message : 'Failed to load service record');
    } finally {
      setLoading(false);
    }
  }, [bookingId, user?.id]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const bookingDisplay = useMemo(() => {
    if (!booking) return null;
    const dt = booking.booking_date ? new Date(booking.booking_date) : null;
    const meta = booking.customer_metadata;
    const cf = meta?.custom_fields && typeof meta.custom_fields === 'object' && !Array.isArray(meta.custom_fields)
      ? (meta.custom_fields as Record<string, unknown>)
      : null;
    const serviceAddress = pickString(cf?.service_address);
    const requestLifecycle = meta?.service_request;
    const requestState = requestStatePresentation(requestLifecycle?.state, booking.status);
    const hasRequestedTime = Boolean(booking.booking_date && booking.booking_time);
    return {
      id: booking.id,
      serviceName: booking.service?.name || booking.title || 'Booked Service',
      vendorName: booking.vendor?.name || 'Vendor',
      vendorPhone: booking.vendor?.phone,
      vendorEmail: booking.vendor?.email,
      vendorLocation: booking.vendor?.location,
      serviceLocation: serviceAddress,
      customerEmail: pickString(meta?.client_email) ?? pickString(cf?.customer_email),
      customerPhone: pickString(meta?.client_phone) ?? pickString(cf?.customer_phone),
      customerNotes: pickString(meta?.user_notes),
      dateText:
        formatDisplayDate(booking.booking_date, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) ||
        (dt && !Number.isNaN(dt.getTime())
          ? dt.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : booking.booking_date || 'Business will propose a time'),
      timeText: formatDisplayTime(booking.booking_time) || booking.booking_time || 'Pending business proposal',
      hasRequestedTime,
      total: Number(booking.total_price || booking.service?.price || 0),
      status: booking.status,
      requestState,
      requestLifecycle,
      createdAt: booking.created_at,
    };
  }, [booking]);

  const handleDownloadReceipt = () => {
    if (!bookingDisplay) return;
    const lines = [
      `Service Request Summary`,
      `Reference ID: ${bookingDisplay.id}`,
      `Service: ${bookingDisplay.serviceName}`,
      `Vendor: ${bookingDisplay.vendorName}`,
      `Requested date: ${bookingDisplay.dateText}`,
      `Requested time: ${bookingDisplay.timeText}`,
      `Status: ${bookingDisplay.requestState.label}`,
      `Reference price: $${bookingDisplay.total.toFixed(2)}`,
      ...(bookingDisplay.customerEmail ? [`Your email: ${bookingDisplay.customerEmail}`] : []),
      ...(bookingDisplay.customerPhone ? [`Your phone: ${bookingDisplay.customerPhone}`] : []),
      ...(bookingDisplay.serviceLocation ? [`Service address: ${bookingDisplay.serviceLocation}`] : []),
      ...(bookingDisplay.customerNotes ? [`Notes: ${bookingDisplay.customerNotes}`] : []),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-record-${bookingDisplay.id}-receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (!bookingDisplay) return;
    navigator.share?.({
      title: 'Service Request',
      text: `Service request sent: ${bookingDisplay.serviceName} with ${bookingDisplay.vendorName}`,
      url: window.location.href,
    });
  };

  const handleGoHome = () => {
    router.push('/user-dashboard');
  };

  const handleViewBookings = () => {
    router.push('/my-bookings');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Loading service-record confirmation...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <p className="text-red-700 font-medium mb-2">Unable to load service-record confirmation</p>
            <p className="text-sm text-gray-600 mb-5">{error}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={loadBooking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={handleViewBookings}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Go to My Service Records
              </button>
            </div>
          </div>
        ) : !bookingDisplay ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-800 font-medium mb-2">Service record not found</p>
            <p className="text-sm text-gray-600 mb-5">The service-record reference may be invalid or unavailable.</p>
            <button
              onClick={handleViewBookings}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Go to My Service Records
            </button>
          </div>
        ) : (
          <>
            {/* Success Message */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Service Request Sent</h1>
              <p className="mx-auto max-w-xl text-gray-600">
                {bookingDisplay.vendorName} has been notified. This is not a confirmed appointment until the business accepts your requested time or you accept a time it proposes.
              </p>
            </div>

            {/* Booking Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Service Record Details</h2>
                  <div className="text-sm text-gray-500" data-testid="booking-confirmation-reference">
                    #{bookingDisplay.id}
                  </div>
                </div>

                {/* Service Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">{bookingDisplay.serviceName}</div>
                  <div className="text-sm text-gray-600">{bookingDisplay.vendorName}</div>
                  <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bookingDisplay.requestState.tone}`}>
                    {bookingDisplay.requestState.label}
                  </span>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-sm text-gray-600">{bookingDisplay.hasRequestedTime ? 'Requested date' : 'Appointment timing'}</div>
                      <div className="font-medium text-gray-900">{bookingDisplay.dateText}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="text-sm text-gray-600">{bookingDisplay.hasRequestedTime ? 'Requested time' : 'Current status'}</div>
                      <div className="font-medium text-gray-900">{bookingDisplay.timeText}</div>
                    </div>
                  </div>
                </div>

                {/* Service location (customer-supplied) vs vendor */}
                {bookingDisplay.serviceLocation ? (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                    <MapPin className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-600">Service address (you provided)</div>
                      <div className="font-medium text-gray-900">{bookingDisplay.serviceLocation}</div>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-6">
                  <MapPin className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-600">Vendor location</div>
                    <div className="font-medium text-gray-900">{bookingDisplay.vendorLocation || '-'}</div>
                  </div>
                </div>

                {(bookingDisplay.customerEmail || bookingDisplay.customerPhone || bookingDisplay.customerNotes) ? (
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Your details (saved with this service record)</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      {bookingDisplay.customerEmail ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span>{bookingDisplay.customerEmail}</span>
                        </div>
                      ) : null}
                      {bookingDisplay.customerPhone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span>{bookingDisplay.customerPhone}</span>
                        </div>
                      ) : null}
                      {bookingDisplay.customerNotes ? (
                        <p className="text-gray-600 pt-1 border-t border-gray-100 mt-2">
                          <span className="font-medium text-gray-800">Notes: </span>
                          {bookingDisplay.customerNotes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Totals — no in-app payment */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Current reference price</span>
                    <span className="text-2xl font-bold text-gray-900">${bookingDisplay.total.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    No card or wallet payment was processed. This is not a final invoice; the business confirms scope and final pricing with you.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">
                      Saved on {new Date(bookingDisplay.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Business contact is revealed after the business accepts the request. */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Communication</h3>
                {bookingDisplay.requestState.accepted ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">The business accepted this request. Reliance will continue recording status updates in My Service Records.</p>
                    <div className="text-gray-700 font-medium">{bookingDisplay.vendorName}</div>
                    {bookingDisplay.vendorPhone ? <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-600" /><span className="text-gray-700">{bookingDisplay.vendorPhone}</span></div> : null}
                    {bookingDisplay.vendorEmail ? <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-600" /><span className="text-gray-700">{bookingDisplay.vendorEmail}</span></div> : null}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-gray-600">Reliance keeps your contact information off public pages. The business receives it securely with this request, and Reliance will notify you when it responds.</p>
                )}
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-700">
                <li>The business reviews your requested service, address, and preferred time.</li>
                <li>It accepts, declines with a reason, or proposes another time.</li>
                <li>Reliance notifies you and updates this record. A proposed time requires your approval.</li>
              </ol>
              <p className="mt-4 rounded-lg border border-blue-200 bg-white/70 px-3 py-2 text-sm text-blue-950">Track the response anytime in <strong>My Service Records</strong>.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadReceipt}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Request Summary
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <button
                onClick={handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
              <button
                onClick={handleViewBookings}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                View My Service Records
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading confirmation…
        </div>
      }
    >
      <BookingConfirmationPageInner />
    </Suspense>
  );
}
