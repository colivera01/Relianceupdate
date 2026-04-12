/**
 * Shared rules for `/my-bookings` (tabs, cancel affordance, status copy, scheduling).
 * Contract rows use snake_case from `mapBookingToContract` / API JSON.
 */

export type MyBookingsTab = 'upcoming' | 'past' | 'cancelled';

/** Lowercase trimmed status; empty input becomes `unknown`. */
export function normalizeBookingStatusKey(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().toLowerCase();
  return s || 'unknown';
}

/** Fully cancelled / voided booking (British or US spelling). */
export function isTerminalCancelledStatus(key: string): boolean {
  return key === 'canceled' || key === 'cancelled';
}

/** Service finished successfully. */
export function isCompletedStatus(key: string): boolean {
  return key === 'completed' || key === 'complete';
}

/**
 * Cancellation requested or in progress, but not yet terminal.
 * Does not return true for terminal cancelled keys.
 */
export function isCancelRequestedFlowStatus(key: string): boolean {
  if (isTerminalCancelledStatus(key)) return false;
  return (
    key === 'cancel_requested' ||
    key === 'cancellation_requested' ||
    key === 'cancellation_pending' ||
    key.includes('cancel_request')
  );
}

/** Review capture (window start + overlays) is suppressed for terminal cancellations only. */
export function shouldEnableReviewCaptureForStatus(key: string): boolean {
  return !isTerminalCancelledStatus(key);
}

/**
 * Single instant used for Upcoming vs Past tab boundaries.
 * Prefers calendar `booking_date` (+ optional `booking_time`); falls back to `created_at`.
 * If both are unusable, uses Unix epoch so the row sorts into Past (explicit, stable).
 */
export function resolveBookingScheduleInstant(
  bookingDate: string | null | undefined,
  bookingTime: string | null | undefined,
  createdAt: string | null | undefined
): { instant: Date; source: 'booking_date' | 'created_at' | 'invalid_fallback' } {
  if (bookingDate && typeof bookingDate === 'string') {
    const combined =
      bookingTime && String(bookingTime).trim()
        ? `${String(bookingDate).trim()}T${String(bookingTime).trim()}`
        : String(bookingDate).trim();
    const d = new Date(combined);
    if (!Number.isNaN(d.getTime())) {
      return { instant: d, source: 'booking_date' };
    }
  }
  if (createdAt && typeof createdAt === 'string') {
    const c = new Date(createdAt.trim());
    if (!Number.isNaN(c.getTime())) {
      return { instant: c, source: 'created_at' };
    }
  }
  return { instant: new Date(0), source: 'invalid_fallback' };
}

export function bookingMatchesSearch(
  row: {
    service: { name: string };
    vendor: { name: string };
    id: string;
    title: string | null;
    client_name: string | null;
  },
  qRaw: string
): boolean {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    row.service.name,
    row.vendor.name,
    String(row.id),
    String(row.title ?? ''),
    String(row.client_name ?? ''),
  ].map((s) => s.toLowerCase());
  return parts.some((p) => p.includes(q));
}

/** Whether this row belongs on the active tab (mutually exclusive buckets). */
export function bookingMatchesTab(
  activeTab: MyBookingsTab,
  statusKey: string,
  scheduleInstant: Date,
  now: Date
): boolean {
  const terminal = isTerminalCancelledStatus(statusKey);
  const completed = isCompletedStatus(statusKey);
  const t = scheduleInstant.getTime();
  const datePast = !Number.isNaN(t) && t < now.getTime();
  const isPast = datePast || completed;

  if (activeTab === 'cancelled') return terminal;
  if (activeTab === 'past') return !terminal && isPast;
  return !terminal && !isPast;
}

export type MyBookingsCancelAction = 'hidden' | 'enabled' | 'disabled';

export function classifyCancelBookingAction(params: {
  statusKey: string;
  scheduleInstant: Date;
  now: Date;
}): { mode: MyBookingsCancelAction; reason?: string } {
  const { statusKey, scheduleInstant, now } = params;
  if (isTerminalCancelledStatus(statusKey) || isCompletedStatus(statusKey)) {
    return { mode: 'hidden' };
  }
  if (isCancelRequestedFlowStatus(statusKey)) {
    return {
      mode: 'disabled',
      reason: 'Cancellation is already in progress for this booking.',
    };
  }
  const t = scheduleInstant.getTime();
  if (!Number.isNaN(t) && t < now.getTime()) {
    return {
      mode: 'disabled',
      reason: 'This booking date has passed. Contact support if you still need changes.',
    };
  }
  return { mode: 'enabled' };
}

/** Human-readable status line (stable product copy for known states). */
export function formatMyBookingsStatusDisplay(raw: string | null | undefined): string {
  const key = normalizeBookingStatusKey(raw);
  if (isTerminalCancelledStatus(key)) return 'Cancelled';
  if (isCompletedStatus(key)) return 'Completed';
  if (key === 'cancel_requested') return 'Cancellation requested';
  if (key === 'cancellation_requested') return 'Cancellation requested';
  if (key === 'cancellation_pending') return 'Cancellation pending';
  if (key === 'unknown') return 'Unknown';
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type MyBookingsRow = {
  id: string;
  service: { id: string; name: string; price: number };
  vendor: { id: string; name: string; phone: string | null };
  user_id: string;
  service_id: string;
  vendor_id: string;
  title: string | null;
  client_name: string | null;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
  total_price: number;
  created_at: string;
  updated_at: string;
};

/** Coerce API / network JSON into a safe row for rendering (never null service/vendor). */
export function sanitizeMyBookingsRow(raw: unknown): MyBookingsRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const id = b.id != null ? String(b.id) : '';
  if (!id) return null;

  const svc = b.service && typeof b.service === 'object' ? (b.service as Record<string, unknown>) : null;
  const ven = b.vendor && typeof b.vendor === 'object' ? (b.vendor as Record<string, unknown>) : null;

  const vendorName =
    ven?.name != null && String(ven.name).trim()
      ? String(ven.name)
      : 'Unknown vendor';
  const serviceName =
    svc?.name != null && String(svc.name).trim() ? String(svc.name) : 'Unknown service';

  const createdRaw = b.created_at != null ? String(b.created_at) : '';
  const createdOk = createdRaw && !Number.isNaN(new Date(createdRaw).getTime()) ? createdRaw : new Date(0).toISOString();
  const updatedRaw = b.updated_at != null ? String(b.updated_at) : '';
  const updatedOk =
    updatedRaw && !Number.isNaN(new Date(updatedRaw).getTime()) ? updatedRaw : createdOk;

  return {
    id,
    user_id: b.user_id != null ? String(b.user_id) : '',
    service_id: b.service_id != null ? String(b.service_id) : '',
    vendor_id: b.vendor_id != null ? String(b.vendor_id) : '',
    title: b.title == null || b.title === '' ? null : String(b.title),
    client_name: b.client_name == null || b.client_name === '' ? null : String(b.client_name),
    booking_date: b.booking_date == null || b.booking_date === '' ? null : String(b.booking_date),
    booking_time: b.booking_time == null || b.booking_time === '' ? null : String(b.booking_time),
    status: b.status != null ? String(b.status) : '',
    total_price: Number(b.total_price ?? 0) || 0,
    created_at: createdOk,
    updated_at: updatedOk,
    service: {
      id: svc?.id != null ? String(svc.id) : '',
      name: serviceName,
      price: Number(svc?.price ?? 0) || 0,
    },
    vendor: {
      id: ven?.id != null ? String(ven.id) : '',
      name: vendorName,
      phone: ven?.phone != null && String(ven.phone) ? String(ven.phone) : null,
    },
  };
}

export function safeSortByCreatedAtDesc(a: MyBookingsRow, b: MyBookingsRow): number {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  const na = Number.isNaN(ta) ? 0 : ta;
  const nb = Number.isNaN(tb) ? 0 : tb;
  return nb - na;
}
