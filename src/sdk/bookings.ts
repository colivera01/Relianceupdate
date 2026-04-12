import { resolveCustomerUserId } from '@/lib/customer-user-id';
import type {
  Booking,
  CreateBookingDTO,
  UpdateBookingDTO,
  Pagination,
} from '../types/api';

type BookingsHttpError = Error & { status?: number };

/**
 * Customer booking APIs resolve the actor via `getUserIdFromRequest` (cookies/session) **or** `x-user-id`.
 * Pass `useAuth().user.id` here so SDK calls match live pages (`/my-bookings`, wizard, confirmation), which
 * send `x-user-id` and (for list) `userId` query. Omitted → `resolveCustomerUserId(undefined)` (storage fallbacks).
 */
async function bookingsRequestJson<T>(
  path: string,
  init: RequestInit = {},
  authUserIdFromCaller?: string
): Promise<T> {
  const userId = resolveCustomerUserId(authUserIdFromCaller);
  const fromInit =
    typeof init.headers === 'object' && init.headers !== null && !Array.isArray(init.headers)
      ? { ...(init.headers as Record<string, string>) }
      : {};
  const withJsonBody = init.body != null && !(init.body instanceof FormData);
  const headers: Record<string, string> = {
    ...fromInit,
    ...(withJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(userId ? { 'x-user-id': userId } : {}),
  };

  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const err = new Error(
      payload?.error || payload?.message || `HTTP ${response.status}`
    ) as BookingsHttpError;
    err.status = response.status;
    throw err;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return {} as T;
}

function buildListQuery(
  params: { userId?: string; vendorId?: string; status?: string; page?: number; limit?: number } | undefined,
  authUserIdFromCaller?: string
): string {
  const resolved = resolveCustomerUserId(authUserIdFromCaller);
  const merged = { ...params };
  if (resolved && merged.userId === undefined && merged.vendorId === undefined) {
    merged.userId = resolved;
  }
  const searchParams = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  const q = searchParams.toString();
  return q ? `?${q}` : '';
}

// Bookings SDK — aligned with customer `fetch` + `x-user-id` + `resolveCustomerUserId` (see BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md).
export const bookingsSDK = {
  async listBookings(
    params?: {
      userId?: string;
      vendorId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    authUserIdFromCaller?: string
  ): Promise<{ bookings: Booking[]; pagination: Pagination }> {
    const query = buildListQuery(params, authUserIdFromCaller);
    return bookingsRequestJson<{ bookings: Booking[]; pagination: Pagination }>(
      `/api/bookings${query}`,
      { method: 'GET' },
      authUserIdFromCaller
    );
  },

  async getBooking(id: string, authUserIdFromCaller?: string): Promise<Booking> {
    const response = await bookingsRequestJson<{ booking: Booking }>(
      `/api/bookings/${encodeURIComponent(id)}`,
      { method: 'GET' },
      authUserIdFromCaller
    );
    return response.booking;
  },

  async createBooking(
    bookingData: CreateBookingDTO & Record<string, unknown>,
    authUserIdFromCaller?: string
  ): Promise<{ success: boolean; booking: Booking }> {
    const d = bookingData as Record<string, unknown>;
    const resolved = resolveCustomerUserId(authUserIdFromCaller);
    const body: Record<string, unknown> = {
      service_id: d.service_id ?? d.serviceId,
      vendor_id: d.vendor_id ?? d.vendorId,
      booking_date: d.booking_date ?? d.bookingDate,
      booking_time: d.booking_time ?? d.bookingTime,
      user_notes: d.user_notes ?? d.userNotes,
      title: d.title,
      client_name: d.client_name ?? d.clientName,
      client_email: d.client_email ?? d.clientEmail,
      client_phone: d.client_phone ?? d.clientPhone,
      amount: d.amount,
      custom_fields: d.custom_fields ?? d.customFields,
      user_id: d.user_id ?? d.userId ?? resolved ?? undefined,
    };
    const cleaned = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    );
    return bookingsRequestJson<{ success: boolean; booking: Booking }>(
      '/api/bookings',
      { method: 'POST', body: JSON.stringify(cleaned) },
      authUserIdFromCaller
    );
  },

  async updateBooking(
    id: string,
    bookingData: UpdateBookingDTO,
    authUserIdFromCaller?: string
  ): Promise<{ success: boolean; booking: Booking }> {
    const d = bookingData as UpdateBookingDTO & {
      booking_date?: string;
      booking_time?: string;
      bookingDate?: string;
      bookingTime?: string;
      title?: string;
      client_name?: string;
      clientName?: string;
      user_notes?: string;
    };
    const body: Record<string, unknown> = {};
    if (d.status !== undefined) body.status = d.status;
    if (d.userNotes !== undefined) body.user_notes = d.userNotes;
    if (d.user_notes !== undefined) body.user_notes = d.user_notes;
    const booking_date = d.booking_date ?? d.bookingDate;
    const booking_time = d.booking_time ?? d.bookingTime;
    if (booking_date !== undefined) body.booking_date = booking_date;
    if (booking_time !== undefined) body.booking_time = booking_time;
    if (d.title !== undefined) body.title = d.title;
    const client_name = d.client_name ?? d.clientName;
    if (client_name !== undefined) body.client_name = client_name;

    return bookingsRequestJson<{ success: boolean; booking: Booking }>(
      `/api/bookings/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      authUserIdFromCaller
    );
  },

  async deleteBooking(id: string, authUserIdFromCaller?: string): Promise<{ success: boolean }> {
    return bookingsRequestJson<{ success: boolean }>(
      `/api/bookings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      authUserIdFromCaller
    );
  },

  async cancelBooking(
    id: string,
    authUserIdFromCaller?: string,
    cancelBody?: { reason?: string; refund_requested?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    const body = cancelBody ?? {
      reason: 'Customer requested cancellation',
      refund_requested: false,
    };
    return bookingsRequestJson<{ success: boolean; message: string }>(
      `/api/bookings/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: JSON.stringify(body) },
      authUserIdFromCaller
    );
  },

  // Deprecated endpoints intentionally removed from active SDK surface:
  // - /api/bookings/[id]/confirm
  // - /api/bookings/[id]/complete
  // - /api/bookings/user/[userId]
  // - /api/bookings/vendor/[vendorId]
};

export const {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  cancelBooking,
} = bookingsSDK;
